from datetime import timedelta

from django.utils import timezone

from apps.geofences.models import Geofence
from apps.signals.models import Signal
from config.geo import alert_location_payload, resolve_nigeria_state

from .models import Alert, AlertRule


CONFIDENCE_RANK = {
    "raw": 0,
    "low": 1,
    "emerging": 2,
    "corroborated": 3,
    "high": 4,
    "disputed": -1,
}

SEVERITY_RANK = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def process_signal_alerts(signal: Signal) -> list[Alert]:
    alerts = []
    alerts.extend(generate_geofence_alerts(signal))
    alerts.extend(generate_rule_based_alerts(signal))
    return alerts


def generate_geofence_alerts(signal: Signal) -> list[Alert]:
    if signal.latitude is None or signal.longitude is None:
        return []

    created_alerts = []
    geofences = Geofence.objects.filter(status="active")
    for geofence in geofences:
        if not geofence.notify_on_signal:
            continue
        if _signal_matches_geofence(signal, geofence):
            location = resolve_nigeria_state(geofence.centroid_latitude, geofence.centroid_longitude)
            title = f"Signal near {geofence.name}"
            if _alert_exists(title=title, geofence=geofence, signal=signal, minutes=180):
                continue
            created_alerts.append(
                Alert.objects.create(
                    geofence=geofence,
                    severity=signal.severity,
                    title=title,
                    message=(
                        f"{signal.get_category_display()} reported near geofence "
                        f"'{geofence.name}'."
                    ),
                    metadata={
                        "signal_id": str(signal.pk),
                        "signal_confidence": signal.confidence,
                        "signal_category": signal.category,
                        **alert_location_payload(
                            label=geofence.name,
                            latitude=location["latitude"],
                            longitude=location["longitude"],
                            state=location["state"],
                        ),
                    },
                )
            )
    return created_alerts


def generate_rule_based_alerts(signal: Signal) -> list[Alert]:
    created_alerts = []
    for rule in AlertRule.objects.filter(is_active=True):
        if not _signal_meets_rule_thresholds(signal, rule):
            continue

        nearby_count = _count_rule_matching_signals(signal, rule)
        if nearby_count < rule.threshold_count:
            continue

        title = f"Rule triggered: {rule.name}"
        if _alert_exists(title=title, rule=rule, signal=signal, minutes=rule.window_minutes):
            continue

        created_alerts.append(
            Alert.objects.create(
                rule=rule,
                cluster=signal.cluster,
                severity=signal.severity,
                title=title,
                message=(
                    f"{nearby_count} matching signals triggered alert rule "
                    f"'{rule.name}' within {rule.window_minutes} minutes."
                ),
                metadata={
                    "signal_id": str(signal.pk),
                    "matching_signal_count": nearby_count,
                    "signal_category": signal.category,
                    **alert_location_payload(
                        label=signal.location_name,
                        latitude=signal.latitude,
                        longitude=signal.longitude,
                        state=resolve_nigeria_state(signal.latitude, signal.longitude)["state"],
                    ),
                },
            )
        )
    return created_alerts


def _count_rule_matching_signals(signal: Signal, rule: AlertRule) -> int:
    threshold_time = timezone.now() - timedelta(minutes=rule.window_minutes)
    queryset = Signal.objects.filter(
        received_at__gte=threshold_time,
        category=signal.category,
    ).exclude(status="dismissed")
    count = 0
    for candidate in queryset:
        if not _signal_meets_rule_thresholds(candidate, rule):
            continue
        if signal.latitude is not None and signal.longitude is not None:
            if not _signals_within_radius(signal, candidate, rule.radius_meters):
                continue
        count += 1
    return count


def _signal_meets_rule_thresholds(signal: Signal, rule: AlertRule) -> bool:
    return (
        CONFIDENCE_RANK.get(signal.confidence, 0) >= CONFIDENCE_RANK.get(rule.min_confidence, 0)
        and SEVERITY_RANK.get(signal.severity, 0) >= SEVERITY_RANK.get(rule.min_severity, 0)
    )


def _signal_matches_geofence(signal: Signal, geofence: Geofence) -> bool:
    if (
        geofence.centroid_latitude is None
        or geofence.centroid_longitude is None
        or geofence.radius_meters is None
    ):
        return False
    return _coordinates_within_radius(
        signal.latitude,
        signal.longitude,
        geofence.centroid_latitude,
        geofence.centroid_longitude,
        geofence.radius_meters,
    )


def _signals_within_radius(signal_a: Signal, signal_b: Signal, radius_meters: int) -> bool:
    if (
        signal_a.latitude is None
        or signal_a.longitude is None
        or signal_b.latitude is None
        or signal_b.longitude is None
    ):
        return False
    return _coordinates_within_radius(
        signal_a.latitude,
        signal_a.longitude,
        signal_b.latitude,
        signal_b.longitude,
        radius_meters,
    )


def _coordinates_within_radius(lat_a, lon_a, lat_b, lon_b, radius_meters: int) -> bool:
    radius_degrees = radius_meters / 111111
    lat_delta = abs(float(lat_a) - float(lat_b))
    lon_delta = abs(float(lon_a) - float(lon_b))
    return lat_delta <= radius_degrees and lon_delta <= radius_degrees


def _alert_exists(title: str, signal: Signal, minutes: int, rule=None, geofence=None) -> bool:
    threshold_time = timezone.now() - timedelta(minutes=minutes)
    queryset = Alert.objects.filter(title=title, triggered_at__gte=threshold_time)
    if rule is not None:
        queryset = queryset.filter(rule=rule)
    if geofence is not None:
        queryset = queryset.filter(geofence=geofence)
    if signal.cluster_id:
        queryset = queryset.filter(cluster=signal.cluster)
    return queryset.exists()
