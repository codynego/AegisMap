from decimal import Decimal
import json
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.utils import timezone

from apps.audit_logs.services import record_audit_event
from apps.alerts.models import Alert
from apps.signals.models import Signal, SignalStatus
from config.geo import alert_location_payload, resolve_nigeria_state

from .models import RiskLevel, RiskSnapshot, WatchZone


def _approx_is_within_zone(signal: Signal, watch_zone: WatchZone) -> bool:
    if (
        signal.latitude is None
        or signal.longitude is None
        or watch_zone.centroid_latitude is None
        or watch_zone.centroid_longitude is None
    ):
        return False

    radius_meters = watch_zone.metadata.get("radius_meters", 5000)
    radius_degrees = Decimal(str(radius_meters)) / Decimal("111111")

    lat_delta = abs(Decimal(signal.latitude) - Decimal(watch_zone.centroid_latitude))
    lon_delta = abs(Decimal(signal.longitude) - Decimal(watch_zone.centroid_longitude))
    return lat_delta <= radius_degrees and lon_delta <= radius_degrees


def evaluate_watch_zone(watch_zone: WatchZone) -> WatchZone:
    previous_level = watch_zone.current_risk_level
    recent_signals = []
    for signal in Signal.objects.order_by("-received_at")[:250]:
        if _approx_is_within_zone(signal, watch_zone):
            recent_signals.append(signal)

    score = Decimal("0.00")
    for signal in recent_signals:
        score += Decimal("0.12")
        if signal.confidence == "emerging":
            score += Decimal("0.10")
        elif signal.confidence == "corroborated":
            score += Decimal("0.20")
        elif signal.confidence == "high":
            score += Decimal("0.30")

        if signal.severity == "medium":
            score += Decimal("0.06")
        elif signal.severity == "high":
            score += Decimal("0.12")
        elif signal.severity == "critical":
            score += Decimal("0.20")

    score = min(score, Decimal("1.00"))

    if score >= Decimal("0.85"):
        level = RiskLevel.CRITICAL
    elif score >= Decimal("0.65"):
        level = RiskLevel.HIGH
    elif score >= Decimal("0.40"):
        level = RiskLevel.MEDIUM
    elif score >= Decimal("0.20"):
        level = RiskLevel.ELEVATED
    else:
        level = RiskLevel.BASELINE

    watch_zone.current_risk_score = (score * Decimal("100")).quantize(Decimal("0.01"))
    watch_zone.current_risk_level = level
    watch_zone.last_evaluated_at = timezone.now()
    watch_zone.save(
        update_fields=["current_risk_score", "current_risk_level", "last_evaluated_at", "updated_at"]
    )
    RiskSnapshot.objects.create(
        watch_zone=watch_zone,
        risk_level=level,
        risk_score=watch_zone.current_risk_score,
        rationale="Automatic risk refresh from nearby signal activity.",
        factors={"matched_signal_count": len(recent_signals)},
    )
    if level != previous_level:
        record_audit_event(
            "risk.level_changed",
            obj=watch_zone,
            description=f"Watch zone '{watch_zone.name}' risk changed from {previous_level} to {level}.",
            metadata={
                "previous_level": previous_level,
                "new_level": level,
                "risk_score": float(watch_zone.current_risk_score),
                "changed_by": "system",
            },
        )
    if level != previous_level and level != RiskLevel.BASELINE:
        location = resolve_nigeria_state(watch_zone.centroid_latitude, watch_zone.centroid_longitude)
        alert = Alert.objects.create(
            watch_zone=watch_zone,
            severity=_risk_level_to_alert_severity(level),
            title=f"Risk changed for {watch_zone.name}",
            message=(
                f"Watch zone moved from {previous_level} to {level} "
                f"based on nearby signal activity."
            ),
            metadata={
                "previous_level": previous_level,
                "new_level": level,
                "risk_score": float(watch_zone.current_risk_score),
                "issued_by": "system",
                "targeting": {
                    "location_radius_meters": watch_zone.metadata.get("radius_meters", 5000),
                    "watched_areas": [location["state"]] if location["state"] else [],
                    "saved_routes": [],
                    "minimum_severity": _risk_level_to_alert_severity(level),
                },
                **alert_location_payload(
                    label=watch_zone.name,
                    latitude=location["latitude"],
                    longitude=location["longitude"],
                    state=location["state"],
                ),
            },
        )
        record_audit_event(
            "alert.issued",
            obj=alert,
            description=f"Alert '{alert.title}' issued for watch zone risk change.",
            metadata={"issued_by": "system", "watch_zone_id": watch_zone.pk},
        )
    return watch_zone


def refresh_watch_zones_for_signal(signal: Signal) -> None:
    if signal.latitude is None or signal.longitude is None:
        return

    for watch_zone in WatchZone.objects.exclude(
        centroid_latitude__isnull=True
    ).exclude(centroid_longitude__isnull=True):
        if _approx_is_within_zone(signal, watch_zone):
            evaluate_watch_zone(watch_zone)


def _risk_level_to_alert_severity(risk_level: str) -> str:
    if risk_level == RiskLevel.CRITICAL:
        return "critical"
    if risk_level == RiskLevel.HIGH:
        return "high"
    return "medium"


FORECAST_CATEGORY_EMERGING_HOTSPOT = "emerging_hotspot"
FORECAST_CATEGORY_ESCALATING_ZONE = "escalating_zone"
FORECAST_CATEGORY_NIGHTTIME_RISK = "nighttime_risk"
FORECAST_CATEGORY_ROUTE_INSTABILITY = "route_instability"
FORECAST_CATEGORY_UNUSUAL_ACTIVITY_SPIKE = "unusual_activity_spike"
FORECAST_CATEGORY_RISK_SPILLOVER = "risk_spillover"
FORECAST_CATEGORY_HEAVY_RAIN_RISK = "heavy_rain_risk"
FORECAST_CATEGORY_FLOOD_RISK = "flood_risk"


def _to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _haversine(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    import math

    earth_radius_km = 6371
    d_lat = math.radians(lat_b - lat_a)
    d_lng = math.radians(lng_b - lng_a)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat_a))
        * math.cos(math.radians(lat_b))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * earth_radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def _is_ongoing(status: str) -> bool:
    normalized = (status or "").strip().lower()
    return normalized not in {"resolved", "closed", "dismissed"}


def _is_night_hour(iso_datetime) -> bool:
    if iso_datetime is None:
        return False
    hour = iso_datetime.hour
    return hour >= 20 or hour < 6


def _risk_level_from_probability(probability: int) -> str:
    if probability >= 82:
        return "critical"
    if probability >= 68:
        return "high"
    if probability >= 52:
        return "elevated"
    if probability >= 36:
        return "guarded"
    return "low"


def _window_from_probability(probability: int) -> str:
    if probability >= 80:
        return "24h"
    if probability >= 58:
        return "72h"
    return "7d"


def _prediction_summary(category: str, cluster_name: str, window: str) -> str:
    if category == FORECAST_CATEGORY_EMERGING_HOTSPOT:
        return f"Incident frequency is rising around {cluster_name}, suggesting an emerging hotspot within {window}."
    if category == FORECAST_CATEGORY_ESCALATING_ZONE:
        return f"Incident severity and activity are escalating around {cluster_name} within {window}."
    if category == FORECAST_CATEGORY_NIGHTTIME_RISK:
        return f"Night-time incident patterns are strengthening around {cluster_name} over the next {window}."
    if category == FORECAST_CATEGORY_ROUTE_INSTABILITY:
        return f"This corridor is showing repeated instability patterns that may worsen within {window}."
    if category == FORECAST_CATEGORY_UNUSUAL_ACTIVITY_SPIKE:
        return f"A sudden activity spike has appeared near {cluster_name} and merits monitoring."
    if category == FORECAST_CATEGORY_HEAVY_RAIN_RISK:
        return f"Weather data suggests heavy rainfall may affect {cluster_name} within {window}."
    if category == FORECAST_CATEGORY_FLOOD_RISK:
        return f"Flood risk is increasing around {cluster_name} due to rainfall patterns and recent incident history within {window}."
    return f"Risk may spread from nearby active zones toward {cluster_name} within {window}."


def _build_signal_points():
    signals = (
        Signal.objects.exclude(latitude__isnull=True)
        .exclude(longitude__isnull=True)
        .exclude(status=SignalStatus.DISMISSED)
        .order_by("-received_at")
    )
    points = []
    for signal in signals:
        latitude = _to_float(signal.latitude)
        longitude = _to_float(signal.longitude)
        if latitude is None or longitude is None:
            continue
        points.append(
            {
                "id": str(signal.id),
                "title": signal.title,
                "incident_type": signal.category,
                "severity": signal.severity,
                "confidence": signal.confidence,
                "status": signal.status,
                "summary": signal.description,
                "detected_at": signal.occurred_at or signal.received_at or signal.created_at,
                "latitude": latitude,
                "longitude": longitude,
                "location_name": signal.location_name,
            }
        )
    return points


def _build_watch_zone_points():
    watch_zones = (
        WatchZone.objects.exclude(centroid_latitude__isnull=True)
        .exclude(centroid_longitude__isnull=True)
        .order_by("name")
    )
    points = []
    for zone in watch_zones:
        latitude = _to_float(zone.centroid_latitude)
        longitude = _to_float(zone.centroid_longitude)
        if latitude is None or longitude is None:
            continue
        points.append(
            {
                "id": zone.id,
                "name": zone.name,
                "risk_level": zone.current_risk_level,
                "risk_score": _to_float(zone.current_risk_score) or 0,
                "latitude": latitude,
                "longitude": longitude,
            }
        )
    return points


def _find_nearest_zone(incident: dict, watch_zones: list[dict], max_distance_km: float) -> dict | None:
    best = None
    min_distance = float("inf")
    for zone in watch_zones:
        distance = _haversine(incident["latitude"], incident["longitude"], zone["latitude"], zone["longitude"])
        if distance < min_distance:
            min_distance = distance
            best = zone
    if best is None or min_distance > max_distance_km:
        return None
    return {"zone": best, "distance_km": min_distance}


def _incident_points_for_weather_forecast(clusters: dict[str, dict]) -> list[dict]:
    points = []
    for cluster_key, cluster in clusters.items():
        points.append(
            {
                "id": cluster_key,
                "latitude": cluster["latitude"],
                "longitude": cluster["longitude"],
                "label": cluster["name"],
                "kind": "prediction",
            }
        )
    return points


def _incident_mentions_flood_or_rain(incident: dict) -> bool:
    haystack = " ".join(
        str(part or "").lower()
        for part in [incident.get("incident_type"), incident.get("location_name"), incident.get("summary")]
    )
    return any(keyword in haystack for keyword in ["flood", "rain", "storm", "drain", "bridge", "water", "road_obstruction"])


def _state_matches_request(requested_state: str, candidate_state: str, candidate_label: str = "") -> bool:
    requested = (requested_state or "").strip().lower()
    if not requested:
        return True

    candidate_state_normalized = (candidate_state or "").strip().lower()
    candidate_label_normalized = (candidate_label or "").strip().lower()
    aliases = {requested}
    if requested == "fct":
        aliases.update({"fct", "fct abuja", "abuja"})
    if requested == "fct abuja":
        aliases.update({"fct", "fct abuja", "abuja"})
    if requested == "abuja":
        aliases.update({"fct", "fct abuja", "abuja"})

    return candidate_state_normalized in aliases or any(alias in candidate_label_normalized for alias in aliases)


def build_risk_forecasts(state: str | None = None) -> list[dict]:
    incidents = _build_signal_points()
    watch_zones = _build_watch_zone_points()
    clusters: dict[str, dict] = {}

    for incident in incidents:
        nearest = _find_nearest_zone(incident, watch_zones, 45)
        fallback_lat = round(incident["latitude"], 1)
        fallback_lng = round(incident["longitude"], 1)
        key = f"zone-{nearest['zone']['id']}" if nearest else f"grid-{fallback_lat}-{fallback_lng}"
        cluster = clusters.get(key)
        if cluster is None:
            cluster = {
                "name": nearest["zone"]["name"] if nearest else incident["location_name"],
                "latitude": nearest["zone"]["latitude"] if nearest else incident["latitude"],
                "longitude": nearest["zone"]["longitude"] if nearest else incident["longitude"],
                "anchor_zone": nearest["zone"] if nearest else None,
                "incidents": [],
                "route_tagged_count": 0,
            }
            clusters[key] = cluster

        cluster["incidents"].append(incident)
        location_name = (incident["location_name"] or "").lower()
        if (
            incident["incident_type"] in {"unsafe_route", "armed_robbery", "kidnapping"}
            or "road" in location_name
            or "highway" in location_name
            or "corridor" in location_name
        ):
            cluster["route_tagged_count"] += 1

    if state:
        filtered_clusters: dict[str, dict] = {}
        for cluster_key, cluster in clusters.items():
            resolved = resolve_nigeria_state(cluster["latitude"], cluster["longitude"])
            if _state_matches_request(state, resolved.get("state", ""), cluster["name"]):
                filtered_clusters[cluster_key] = cluster
        clusters = filtered_clusters

    weather_rows: list[dict] = []
    weather_lookup: dict[str, dict] = {}
    try:
        weather_rows = _fetch_weather_rows(_incident_points_for_weather_forecast(clusters))
        weather_lookup = {row["id"]: row for row in weather_rows}
    except Exception:
        weather_lookup = {}

    now = timezone.now().timestamp()
    seventy_two_hours_ago = now - 72 * 60 * 60
    seven_days_ago = now - 7 * 24 * 60 * 60
    fourteen_days_ago = now - 14 * 24 * 60 * 60

    forecasts: list[dict] = []
    for cluster_key, cluster in clusters.items():
        recent = [
            incident
            for incident in cluster["incidents"]
            if incident["detected_at"] and incident["detected_at"].timestamp() >= seven_days_ago
        ]
        previous = [
            incident
            for incident in cluster["incidents"]
            if incident["detected_at"]
            and fourteen_days_ago <= incident["detected_at"].timestamp() < seven_days_ago
        ]
        short_term = [
            incident
            for incident in cluster["incidents"]
            if incident["detected_at"] and incident["detected_at"].timestamp() >= seventy_two_hours_ago
        ]
        active_reports = sum(1 for incident in recent if _is_ongoing(incident["status"]))
        high_severity_count = sum(1 for incident in recent if incident["severity"] in {"high", "critical"})
        night_share = (
            sum(1 for incident in recent if _is_night_hour(incident["detected_at"])) / len(recent) if recent else 0
        )
        route_signal = cluster["route_tagged_count"] / max(len(cluster["incidents"]), 1) if recent else 0
        anomaly_signal = 1 if len(previous) == 0 and len(recent) >= 2 else _clamp((len(recent) - len(previous)) / 5, 0, 1)
        growth = len(recent) / max(len(previous), 1)
        zone_support = ((cluster["anchor_zone"] or {}).get("risk_score", 0)) / 100
        weather_row = weather_lookup.get(cluster_key)
        precipitation_mm = float(weather_row["precipitation_mm"]) if weather_row else 0.0
        visibility_m = weather_row["visibility_m"] if weather_row else None
        weather_code = weather_row["weather_code"] if weather_row else None
        weather_severity = _weather_severity(precipitation_mm, visibility_m, weather_code)
        flood_like_history = sum(1 for incident in cluster["incidents"] if _incident_mentions_flood_or_rain(incident))
        heavy_rain_signal = precipitation_mm * 4 + (12 if weather_severity in {"high", "extreme"} else 0)
        flood_signal = heavy_rain_signal + flood_like_history * 8 + (8 if cluster["route_tagged_count"] >= 2 else 0)

        escalation_signal = ((high_severity_count / len(recent)) * 18 + growth * 10 + active_reports * 4) if recent else 0
        hotspot_score = len(recent) * 8 + len(short_term) * 5 + growth * 8
        escalation_score = high_severity_count * 8 + escalation_signal + zone_support * 18
        time_score = night_share * 26 + (10 if len(short_term) >= 2 else 0) + active_reports * 2
        route_score = route_signal * 24 + (12 if cluster["route_tagged_count"] >= 3 else 0)
        unusual_score = anomaly_signal * 28
        spillover_score = zone_support * 16 + (10 if growth > 1.4 else 0)

        category_scores = [
            (FORECAST_CATEGORY_EMERGING_HOTSPOT, hotspot_score),
            (FORECAST_CATEGORY_ESCALATING_ZONE, escalation_score),
            (FORECAST_CATEGORY_NIGHTTIME_RISK, time_score),
            (FORECAST_CATEGORY_ROUTE_INSTABILITY, route_score),
            (FORECAST_CATEGORY_UNUSUAL_ACTIVITY_SPIKE, unusual_score),
            (FORECAST_CATEGORY_RISK_SPILLOVER, spillover_score),
            (FORECAST_CATEGORY_HEAVY_RAIN_RISK, heavy_rain_signal),
            (FORECAST_CATEGORY_FLOOD_RISK, flood_signal),
        ]
        category, top_category_score = max(category_scores, key=lambda item: item[1])

        probability = int(
            _clamp(
                round(
                    22
                    + len(recent) * 7
                    + len(short_term) * 4
                    + growth * 7
                    + high_severity_count * 4
                    + active_reports * 3
                    + zone_support * 20
                    + route_signal * 12
                    + min(22, precipitation_mm * 2.5)
                    + (8 if weather_severity in {"high", "extreme"} else 0)
                    + min(12, flood_like_history * 3)
                ),
                24,
                94,
            )
        )
        confidence = int(
            _clamp(
                round(
                    35
                    + min(25, len(cluster["incidents"]) * 3)
                    + min(15, len(recent) * 2)
                    + zone_support * 18
                    + (8 if top_category_score >= 24 else 0)
                ),
                36,
                92,
            )
        )
        window = _window_from_probability(probability)
        rationale = [
            f"{len(recent)} incidents in the last 7 days versus {len(previous)} in the prior week.",
            (
                f"{high_severity_count} high-severity incident{'s' if high_severity_count != 1 else ''} support the escalation signal."
                if high_severity_count > 0
                else "Severity profile remains mixed rather than concentrated."
            ),
            (
                f"{round(night_share * 100)}% of recent activity occurred at night."
                if night_share >= 0.5
                else f"Night-time activity remains limited at {round(night_share * 100)}% of recent reports."
            ),
        ]
        if route_signal >= 0.45:
            rationale.append("The recent pattern is concentrated around corridors and route-linked reports.")
        if anomaly_signal >= 0.8:
            rationale.append("This region was relatively quiet before the latest spike, which raises anomaly risk.")
        if cluster["anchor_zone"] and cluster["anchor_zone"]["risk_score"] >= 60:
            rationale.append(
                f"Existing watch-zone pressure around {cluster['anchor_zone']['name']} corroborates the forecast."
            )
        if weather_row:
            rationale.append(
                f"Weather API indicates { _rainfall_intensity_label(precipitation_mm).lower() } rainfall and { _visibility_label(visibility_m).lower() } visibility at this location."
            )
            if flood_like_history > 0:
                rationale.append(
                    f"{flood_like_history} prior incident{'s' if flood_like_history != 1 else ''} suggest this area is vulnerable to water-related disruption when rain increases."
                )

        forecast = {
            "id": cluster_key,
            "cluster_name": cluster["name"],
            "category": category,
            "level": _risk_level_from_probability(probability),
            "probability": probability,
            "confidence": confidence,
            "window": window,
            "latitude": cluster["latitude"],
            "longitude": cluster["longitude"],
            "summary": _prediction_summary(category, cluster["name"], window),
            "rationale": rationale,
            "timing_note": (
                "Recent activity is clustering after dark. Evening movement should be monitored more closely."
                if category == FORECAST_CATEGORY_NIGHTTIME_RISK
                else "Repeated route-linked reporting suggests corridor conditions may degrade further."
                if category == FORECAST_CATEGORY_ROUTE_INSTABILITY
                else "This is a risk forecast based on patterns, not a claim of confirmed adversary presence."
            ),
            "source_count": len(cluster["incidents"]),
            "recent_count": len(recent),
            "previous_count": len(previous),
            "active_reports": active_reports,
            "high_severity_count": high_severity_count,
            "night_share": round(night_share, 4),
            "route_signal": round(route_signal, 4),
            "anomaly_signal": round(anomaly_signal, 4),
            "weather_severity": weather_severity,
            "precipitation_mm": round(precipitation_mm, 2),
            "visibility_m": visibility_m,
            "weather_code": weather_code,
            "flood_like_history": flood_like_history,
        }
        if forecast["recent_count"] >= 2 or forecast["probability"] >= 58:
            forecasts.append(forecast)

    return sorted(forecasts, key=lambda item: (item["probability"], item["confidence"]), reverse=True)[:12]


WEATHER_CODE_LABELS = {
    0: "Clear conditions",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail",
}


def _weather_label(code: int | None) -> str:
    if code is None:
        return "Weather signal detected"
    return WEATHER_CODE_LABELS.get(code, "Weather signal detected")


def _weather_severity(precipitation_mm: float, visibility_m: float | None, weather_code: int | None) -> str:
    if (
        precipitation_mm >= 18
        or (visibility_m is not None and visibility_m < 1000)
        or weather_code in {95, 96, 99}
    ):
        return "extreme"
    if (
        precipitation_mm >= 8
        or (visibility_m is not None and visibility_m < 3000)
        or weather_code in {65, 67, 81, 82}
    ):
        return "high"
    if (
        precipitation_mm >= 2
        or (visibility_m is not None and visibility_m < 7000)
        or weather_code in {45, 48, 53, 55, 61, 63, 80}
    ):
        return "moderate"
    return "low"


def _weather_intensity(severity: str, precipitation_mm: float, visibility_m: float | None) -> float:
    base = {
        "low": 0.25,
        "moderate": 0.5,
        "high": 0.78,
        "extreme": 1.0,
    }[severity]
    precipitation_boost = min(0.28, precipitation_mm / 30)
    visibility_boost = 0
    if visibility_m is not None:
        visibility_boost = min(0.24, max(0, (7000 - visibility_m) / 7000))
    return round(min(1.0, base + precipitation_boost + visibility_boost), 3)


def _rainfall_intensity_label(precipitation_mm: float) -> str:
    if precipitation_mm >= 18:
        return "Very high"
    if precipitation_mm >= 8:
        return "High"
    if precipitation_mm >= 2:
        return "Moderate"
    if precipitation_mm > 0:
        return "Light"
    return "Minimal"


def _visibility_label(visibility_m: float | None) -> str:
    if visibility_m is None:
        return "Unknown"
    if visibility_m < 1000:
        return "Very low"
    if visibility_m < 3000:
        return "Low"
    if visibility_m < 7000:
        return "Reduced"
    return "Normal"


def _normalize_risk_level(score: float) -> str:
    if score >= 85:
        return RiskLevel.CRITICAL
    if score >= 65:
        return RiskLevel.HIGH
    if score >= 40:
        return RiskLevel.MEDIUM
    if score >= 20:
        return RiskLevel.ELEVATED
    return RiskLevel.BASELINE


def _nearest_weather_point(latitude: float, longitude: float, overlays: list[dict]) -> dict | None:
    best_match = None
    best_distance = float("inf")
    for overlay in overlays:
        distance = _haversine(latitude, longitude, overlay["latitude"], overlay["longitude"])
        if distance < best_distance:
            best_distance = distance
            best_match = overlay
    return best_match


def _fetch_weather_rows(points: list[dict]) -> list[dict]:
    if not points:
        return []

    params = urlencode(
        {
            "latitude": ",".join(f"{point['latitude']:.5f}" for point in points),
            "longitude": ",".join(f"{point['longitude']:.5f}" for point in points),
            "current": "precipitation,visibility,weather_code",
            "timezone": "GMT",
            "forecast_hours": 1,
        }
    )
    request_url = f"{settings.WEATHER_INTELLIGENCE_BASE_URL}?{params}"

    with urlopen(request_url, timeout=settings.WEATHER_INTELLIGENCE_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if isinstance(payload, list):
        rows = payload
    else:
        rows = [payload]

    mapped = []
    for index, row in enumerate(rows):
        current = row.get("current", {})
        point = points[index]
        mapped.append(
            {
                "id": point.get("id") or f"point-{index}",
                "latitude": point["latitude"],
                "longitude": point["longitude"],
                "label": point.get("label") or point.get("location_name") or "Weather point",
                "kind": point.get("kind") or "point",
                "incident_type": point.get("incident_type") or "",
                "severity_hint": point.get("severity") or "",
                "summary": point.get("summary") or "",
                "location_name": point.get("location_name") or "",
                "precipitation_mm": float(current.get("precipitation") or 0),
                "visibility_m": (
                    float(current["visibility"]) if current.get("visibility") is not None else None
                ),
                "weather_code": int(current["weather_code"]) if current.get("weather_code") is not None else None,
            }
        )
    return mapped


def build_weather_intelligence(points: list[dict], watch_zones: list[dict], route_path: list[list[float]]) -> dict:
    requested_points = [*points]
    for zone in watch_zones:
        requested_points.append(
            {
                "id": f"watch-zone-{zone['id']}",
                "latitude": zone["latitude"],
                "longitude": zone["longitude"],
                "label": zone["name"],
                "kind": "watch_zone",
            }
        )

    if len(route_path) >= 2:
        for index in range(len(route_path) - 1):
            start_lng, start_lat = route_path[index]
            end_lng, end_lat = route_path[index + 1]
            requested_points.append(
                {
                    "id": f"route-segment-{index}",
                    "latitude": round((start_lat + end_lat) / 2, 5),
                    "longitude": round((start_lng + end_lng) / 2, 5),
                    "label": f"Route segment {index + 1}",
                    "kind": "route_segment",
                }
            )

    weather_rows = _fetch_weather_rows(requested_points)
    overlays: list[dict] = []
    incident_contexts: list[dict] = []
    alerts: list[dict] = []
    route_segments: list[dict] = []

    for row in weather_rows:
        severity = _weather_severity(row["precipitation_mm"], row["visibility_m"], row["weather_code"])
        overlay = {
            "source_id": row["id"],
            "kind": row["kind"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "severity": severity,
            "intensity": _weather_intensity(severity, row["precipitation_mm"], row["visibility_m"]),
            "title": _weather_label(row["weather_code"]),
            "summary": (
                f"{_rainfall_intensity_label(row['precipitation_mm'])} precipitation with "
                f"{_visibility_label(row['visibility_m']).lower()} visibility."
            ),
            "precipitation_mm": round(row["precipitation_mm"], 2),
            "visibility_km": round((row["visibility_m"] or 0) / 1000, 2) if row["visibility_m"] is not None else None,
            "weather_code": row["weather_code"],
            "label": row["label"],
        }
        overlays.append(overlay)

        if row["kind"] == "incident":
            context = {
                "source_id": row["id"],
                "label": "Weather context",
                "severity": severity,
                "rainfall_intensity": _rainfall_intensity_label(row["precipitation_mm"]),
                "visibility": _visibility_label(row["visibility_m"]),
                "summary": (
                    f"{_weather_label(row['weather_code'])}. "
                    f"Rainfall is {_rainfall_intensity_label(row['precipitation_mm']).lower()} and visibility is "
                    f"{_visibility_label(row['visibility_m']).lower()} around this incident."
                ),
                "alerts": [
                    f"{_rainfall_intensity_label(row['precipitation_mm'])} rainfall detected",
                    f"{_visibility_label(row['visibility_m'])} visibility",
                ],
                "precipitation_mm": overlay["precipitation_mm"],
                "visibility_km": overlay["visibility_km"],
                "weather_code": row["weather_code"],
            }
            incident_contexts.append(context)
            if severity in {"high", "extreme"}:
                alerts.append(
                    {
                        "id": f"incident-weather-{row['id']}",
                        "severity": severity,
                        "title": f"{_weather_label(row['weather_code'])} near {row['label']}",
                        "summary": context["summary"],
                        "latitude": row["latitude"],
                        "longitude": row["longitude"],
                        "source_id": row["id"],
                    }
                )

        if row["kind"] == "route_segment":
            route_segments.append(
                {
                    "source_id": row["id"],
                    "severity": severity,
                    "summary": (
                        f"{_rainfall_intensity_label(row['precipitation_mm'])} rain, "
                        f"{_visibility_label(row['visibility_m']).lower()} visibility."
                    ),
                    "precipitation_mm": overlay["precipitation_mm"],
                    "visibility_km": overlay["visibility_km"],
                }
            )

    risk_zone_adjustments = []
    for zone in watch_zones:
        nearest = _nearest_weather_point(zone["latitude"], zone["longitude"], overlays)
        if nearest is None:
            continue
        bump = {
            "low": 0,
            "moderate": 8,
            "high": 14,
            "extreme": 22,
        }[nearest["severity"]]
        adjusted_score = min(100, round(float(zone["risk_score"]) + bump, 2))
        risk_zone_adjustments.append(
            {
                "watch_zone_id": str(zone["id"]),
                "weather_severity": nearest["severity"],
                "weather_adjusted_risk_score": adjusted_score,
                "weather_adjusted_risk_level": _normalize_risk_level(adjusted_score),
                "summary": (
                    f"{nearest['title']} is increasing exposure around {zone['name']}."
                ),
            }
        )
        if nearest["severity"] in {"high", "extreme"}:
            alerts.append(
                {
                    "id": f"watch-zone-weather-{zone['id']}",
                    "severity": nearest["severity"],
                    "title": f"Flood / weather pressure near {zone['name']}",
                    "summary": (
                        f"{nearest['summary']} Risk score should be treated as elevated."
                    ),
                    "latitude": zone["latitude"],
                    "longitude": zone["longitude"],
                    "source_id": str(zone["id"]),
                }
            )

    route = {"advisories": [], "segments": [], "max_severity": "low"}
    if len(route_path) >= 2 and route_segments:
        max_severity = max(
            route_segments,
            key=lambda segment: {"low": 0, "moderate": 1, "high": 2, "extreme": 3}[segment["severity"]],
        )["severity"]
        advisories = []
        high_segments = [
            segment for segment in route_segments if segment["severity"] in {"high", "extreme"}
        ]
        reduced_visibility = [
            segment
            for segment in route_segments
            if segment["visibility_km"] is not None and segment["visibility_km"] < 7
        ]
        if high_segments:
            advisories.append(
                f"{len(high_segments)} route segment{'s' if len(high_segments) != 1 else ''} have heavy rainfall or storm pressure."
            )
        if reduced_visibility:
            advisories.append(
                f"{len(reduced_visibility)} route segment{'s' if len(reduced_visibility) != 1 else ''} show low or reduced visibility."
            )
        if not advisories:
            advisories.append("Weather impact on the corridor is currently limited.")
        route = {
            "advisories": advisories,
            "segments": [
                {
                    **segment,
                    "start": route_path[index],
                    "end": route_path[index + 1],
                }
                for index, segment in enumerate(route_segments[: len(route_path) - 1])
            ],
            "max_severity": max_severity,
        }

    return {
        "provider": "Open-Meteo ECMWF",
        "fetched_at": timezone.now().isoformat(),
        "overlay": overlays,
        "incident_contexts": incident_contexts,
        "alerts": alerts,
        "risk_zone_adjustments": risk_zone_adjustments,
        "route": route,
    }
