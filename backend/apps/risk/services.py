from decimal import Decimal

from django.utils import timezone

from apps.alerts.models import Alert
from apps.signals.models import Signal

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
