from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .models import Geofence, GeofenceStatus, GeofenceType


VALID_GEOFENCE_TYPES = {choice for choice, _ in GeofenceType.choices}
VALID_GEOFENCE_STATUSES = {choice for choice, _ in GeofenceStatus.choices}

NAME_ALIASES = (
    "name",
    "school_name",
    "facility_name",
    "settlement_name",
    "official_name",
    "title",
)
DESCRIPTION_ALIASES = ("description", "desc", "notes", "comment")
LATITUDE_ALIASES = ("centroid_latitude", "latitude", "lat", "y")
LONGITUDE_ALIASES = ("centroid_longitude", "longitude", "lng", "lon", "x")
RADIUS_ALIASES = ("radius_meters", "radius", "buffer_m", "buffer")
STATUS_ALIASES = ("status",)

DEFAULT_RADIUS_BY_TYPE = {
    GeofenceType.SCHOOL: 2000,
    GeofenceType.VILLAGE: 1500,
    GeofenceType.HIGHWAY: 2500,
    GeofenceType.PIPELINE: 2000,
    GeofenceType.FACILITY: 2000,
    GeofenceType.CUSTOM: 1000,
}


@dataclass(frozen=True)
class DatasetPreset:
    default_type: str
    default_radius_meters: int
    infer_from_tags: bool = False


DATASET_PRESETS = {
    "bemis": DatasetPreset(default_type=GeofenceType.SCHOOL, default_radius_meters=2000),
    "grid3_settlements": DatasetPreset(default_type=GeofenceType.VILLAGE, default_radius_meters=1500),
    "grid3_settlement_extents": DatasetPreset(default_type=GeofenceType.VILLAGE, default_radius_meters=1500),
    "grid3_health": DatasetPreset(default_type=GeofenceType.FACILITY, default_radius_meters=2000),
    "grid3_roads": DatasetPreset(default_type=GeofenceType.HIGHWAY, default_radius_meters=2500),
    "osm": DatasetPreset(default_type=GeofenceType.CUSTOM, default_radius_meters=1000, infer_from_tags=True),
    "custom": DatasetPreset(default_type=GeofenceType.CUSTOM, default_radius_meters=1000),
}


def import_geofences_from_dataset(
    dataset: str,
    file_path: str | Path,
    *,
    geofence_type: str | None = None,
    radius_meters: int | None = None,
    status: str = GeofenceStatus.ACTIVE,
    name_field: str | None = None,
    latitude_field: str | None = None,
    longitude_field: str | None = None,
    dry_run: bool = False,
    update_existing: bool = True,
) -> dict[str, Any]:
    dataset_key = dataset.strip().lower()
    if dataset_key not in DATASET_PRESETS:
        raise ValueError(f"Unsupported dataset '{dataset}'.")

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    normalized_status = normalize_status(status)
    preset = DATASET_PRESETS[dataset_key]
    rows = list(load_dataset_rows(path))
    summary = {
        "dataset": dataset_key,
        "file_path": str(path),
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": [],
    }

    for index, row in enumerate(rows, start=1):
        try:
            payload = build_geofence_payload(
                row,
                dataset=dataset_key,
                row_number=index,
                file_name=path.name,
                default_type=geofence_type or preset.default_type,
                default_radius_meters=radius_meters or preset.default_radius_meters,
                default_status=normalized_status,
                name_field=name_field,
                latitude_field=latitude_field,
                longitude_field=longitude_field,
                infer_type_from_tags=preset.infer_from_tags and geofence_type is None,
            )
        except ValueError as exc:
            summary["skipped"] += 1
            summary["errors"].append(f"Row {index}: {exc}")
            continue

        if dry_run:
            summary["created"] += 1
            continue

        lookup = {
            "name": payload["name"],
            "geofence_type": payload["geofence_type"],
        }
        if update_existing:
            _, created = Geofence.objects.update_or_create(defaults=payload, **lookup)
            summary["created" if created else "updated"] += 1
        else:
            Geofence.objects.create(**payload)
            summary["created"] += 1

    return summary


def load_dataset_rows(path: Path) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return list(load_csv_rows(path))
    if suffix in {".json", ".geojson"}:
        return list(load_json_rows(path))
    raise ValueError(f"Unsupported dataset format '{suffix}'. Use CSV or GeoJSON/JSON.")


def load_csv_rows(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            yield {str(key).strip(): value for key, value in row.items() if key is not None}


def load_json_rows(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection":
        for feature in payload.get("features", []):
            if not isinstance(feature, dict):
                continue
            properties = feature.get("properties") or {}
            geometry = feature.get("geometry")
            row = dict(properties)
            row["_geometry"] = geometry
            yield row
        return

    if isinstance(payload, list):
        for row in payload:
            if isinstance(row, dict):
                yield row
        return

    if isinstance(payload, dict):
        yield payload
        return

    raise ValueError("Unsupported JSON payload. Expected a FeatureCollection, list, or object.")


def build_geofence_payload(
    row: dict[str, Any],
    *,
    dataset: str,
    row_number: int,
    file_name: str,
    default_type: str,
    default_radius_meters: int,
    default_status: str,
    name_field: str | None,
    latitude_field: str | None,
    longitude_field: str | None,
    infer_type_from_tags: bool,
) -> dict[str, Any]:
    name = first_value(row, (name_field,) if name_field else NAME_ALIASES)
    if not name:
        raise ValueError("missing geofence name")

    geometry = row.get("_geometry")
    latitude = parse_decimal(first_value(row, (latitude_field,) if latitude_field else LATITUDE_ALIASES))
    longitude = parse_decimal(first_value(row, (longitude_field,) if longitude_field else LONGITUDE_ALIASES))

    if (latitude is None or longitude is None) and geometry:
        centroid = geometry_centroid(geometry)
        if centroid is not None:
            longitude = Decimal(str(centroid[0]))
            latitude = Decimal(str(centroid[1]))

    if latitude is None or longitude is None:
        raise ValueError("missing latitude/longitude and no usable geometry centroid")

    raw_type = None
    if infer_type_from_tags:
        raw_type = infer_type_from_row(row)
    geofence_type = normalize_geofence_type(raw_type or default_type)

    radius_value = parse_int(first_value(row, RADIUS_ALIASES))
    resolved_radius = radius_value
    if resolved_radius is None:
        if infer_type_from_tags and raw_type:
            resolved_radius = DEFAULT_RADIUS_BY_TYPE[geofence_type]
        else:
            resolved_radius = default_radius_meters or DEFAULT_RADIUS_BY_TYPE[geofence_type]

    raw_status = first_value(row, STATUS_ALIASES)
    geofence_status = normalize_status(raw_status or default_status)

    boundary = geometry if geometry else {}
    description = first_value(row, DESCRIPTION_ALIASES) or ""
    metadata = {
        "import_dataset": dataset,
        "source_file": file_name,
        "source_row": row_number,
        "imported": True,
    }
    if raw_type:
        metadata["raw_type"] = raw_type

    return {
        "name": str(name).strip(),
        "geofence_type": geofence_type,
        "status": geofence_status,
        "boundary": boundary,
        "centroid_latitude": latitude,
        "centroid_longitude": longitude,
        "radius_meters": resolved_radius,
        "description": str(description).strip(),
        "notify_on_signal": True,
        "notify_on_incident": True,
        "metadata": metadata,
    }


def first_value(row: dict[str, Any], keys: tuple[str, ...] | list[str]) -> Any:
    lowered = {str(key).strip().lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return None


def parse_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        return None


def parse_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return None


def normalize_geofence_type(value: str | None) -> str:
    if not value:
        return GeofenceType.CUSTOM
    key = str(value).strip().lower().replace(" ", "_")
    if key in VALID_GEOFENCE_TYPES:
        return key

    school_values = {"school", "college", "university", "kindergarten", "education"}
    village_values = {"village", "hamlet", "town", "settlement", "community"}
    highway_values = {
        "highway",
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "road",
        "residential",
    }
    facility_values = {
        "facility",
        "hospital",
        "clinic",
        "health_post",
        "healthcare",
        "checkpoint",
        "police",
        "military",
        "market",
        "plant",
        "station",
    }

    if key in school_values:
        return GeofenceType.SCHOOL
    if key in village_values:
        return GeofenceType.VILLAGE
    if key in highway_values:
        return GeofenceType.HIGHWAY
    if key == "pipeline":
        return GeofenceType.PIPELINE
    if key in facility_values:
        return GeofenceType.FACILITY
    return GeofenceType.CUSTOM


def normalize_status(value: str | None) -> str:
    if not value:
        return GeofenceStatus.ACTIVE
    key = str(value).strip().lower()
    if key in VALID_GEOFENCE_STATUSES:
        return key
    return GeofenceStatus.ACTIVE


def infer_type_from_row(row: dict[str, Any]) -> str | None:
    for key in ("geofence_type", "type", "amenity", "place", "highway", "man_made", "building"):
        value = first_value(row, (key,))
        if value:
            normalized = normalize_geofence_type(str(value))
            if normalized != GeofenceType.CUSTOM or str(value).strip().lower() == "custom":
                return str(value)
    return None


def geometry_centroid(geometry: dict[str, Any] | None) -> tuple[float, float] | None:
    if not geometry:
        return None
    coordinates = geometry.get("coordinates")
    pairs = list(iter_coordinate_pairs(coordinates))
    if not pairs:
        return None
    lng = sum(pair[0] for pair in pairs) / len(pairs)
    lat = sum(pair[1] for pair in pairs) / len(pairs)
    return (lng, lat)


def iter_coordinate_pairs(value: Any):
    if not isinstance(value, list):
        return
    if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
        yield (float(value[0]), float(value[1]))
        return
    for item in value:
        yield from iter_coordinate_pairs(item)
