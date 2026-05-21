from decimal import Decimal

from django.conf import settings


EARTH_METERS_PER_DEGREE = Decimal("111111")


def database_supports_postgis() -> bool:
    return getattr(settings, "DATABASE_BACKEND", "sqlite") == "postgis"


def radius_to_degrees(radius_meters: int | float | Decimal) -> Decimal:
    return Decimal(str(radius_meters)) / EARTH_METERS_PER_DEGREE


def coordinates_within_radius(lat_a, lon_a, lat_b, lon_b, radius_meters: int | float) -> bool:
    if lat_a is None or lon_a is None or lat_b is None or lon_b is None:
        return False
    radius_degrees = float(radius_to_degrees(radius_meters))
    lat_delta = abs(float(lat_a) - float(lat_b))
    lon_delta = abs(float(lon_a) - float(lon_b))
    return lat_delta <= radius_degrees and lon_delta <= radius_degrees


def point_payload(latitude, longitude) -> dict | None:
    if latitude is None or longitude is None:
        return None
    return {
        "type": "Point",
        "coordinates": [float(longitude), float(latitude)],
    }
