from decimal import Decimal

from django.utils import timezone

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
    if level != previous_level and level != RiskLevel.BASELINE:
        location = resolve_nigeria_state(watch_zone.centroid_latitude, watch_zone.centroid_longitude)
        Alert.objects.create(
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
                **alert_location_payload(
                    label=watch_zone.name,
                    latitude=location["latitude"],
                    longitude=location["longitude"],
                    state=location["state"],
                ),
            },
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


def build_risk_forecasts() -> list[dict]:
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
        }
        if forecast["recent_count"] >= 2 or forecast["probability"] >= 58:
            forecasts.append(forecast)

    return sorted(forecasts, key=lambda item: (item["probability"], item["confidence"]), reverse=True)[:12]
