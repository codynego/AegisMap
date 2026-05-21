from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from apps.alerts.services import process_signal_alerts
from apps.incidents.services import process_signal_intelligence
from apps.risk.services import refresh_watch_zones_for_signal
from apps.users.services import update_source_statistics

from .models import ConfidenceLevel, Signal, SignalStatus


def calculate_signal_confidence_score(signal: Signal) -> Decimal:
    score = Decimal("0.20")

    if signal.source_profile:
        score += Decimal(signal.source_profile.trust_score) * Decimal("0.35")

    if signal.latitude is not None and signal.longitude is not None:
        score += Decimal("0.10")
    if signal.occurred_at:
        score += Decimal("0.10")
    if signal.route_hint:
        score += Decimal("0.05")
    if signal.extracted_entities:
        score += Decimal("0.05")

    evidence_count = signal.evidence_items.count()
    if evidence_count >= 1:
        score += Decimal("0.10")
    if evidence_count >= 2:
        score += Decimal("0.05")

    if signal.cluster_id:
        score += Decimal("0.10")

    return max(Decimal("0.00"), min(Decimal("1.00"), score))


def map_score_to_confidence(score: Decimal) -> str:
    if score >= Decimal("0.85"):
        return ConfidenceLevel.HIGH
    if score >= Decimal("0.65"):
        return ConfidenceLevel.CORROBORATED
    if score >= Decimal("0.45"):
        return ConfidenceLevel.EMERGING
    if score >= Decimal("0.25"):
        return ConfidenceLevel.LOW
    return ConfidenceLevel.RAW


def assess_signal(signal: Signal) -> Signal:
    intelligence_result = process_signal_intelligence(signal)
    signal.refresh_from_db()
    score = calculate_signal_confidence_score(signal)
    signal.confidence = map_score_to_confidence(score)
    if signal.status == SignalStatus.RAW:
        signal.status = SignalStatus.TRIAGED

    signal.metadata = {
        **signal.metadata,
        "confidence_score": float(score),
        "assessed_at": timezone.now().isoformat(),
        "cluster_id": signal.cluster_id,
        "pattern_id": getattr(intelligence_result.get("pattern"), "pk", None),
        "incident_id": getattr(intelligence_result.get("incident"), "pk", None),
    }
    signal.save(update_fields=["confidence", "status", "metadata", "updated_at"])

    if signal.source_profile:
        signal.source_profile.last_seen_at = timezone.now()
        signal.source_profile.save(update_fields=["last_seen_at"])
        update_source_statistics(signal.source_profile)

    refresh_watch_zones_for_signal(signal)
    process_signal_alerts(signal)
    return signal


def run_signal_pipeline(signal: Signal) -> Signal:
    return assess_signal(signal)


def dispatch_signal_pipeline(signal: Signal) -> Signal:
    if settings.USE_ASYNC_TASKS:
        from .tasks import run_signal_pipeline_task

        run_signal_pipeline_task.delay(str(signal.pk))
        return signal
    return run_signal_pipeline(signal)
