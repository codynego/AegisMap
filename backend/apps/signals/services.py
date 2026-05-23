from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from apps.alerts.services import process_signal_alerts
from apps.incidents.services import process_signal_intelligence
from apps.risk.services import refresh_watch_zones_for_signal
from apps.users.models import SourceType, UserRole
from apps.users.services import update_source_statistics

from .models import ConfidenceLevel, Signal, SignalStatus, SignalVerification, VerificationResponse


SENSITIVE_SIGNAL_CATEGORIES = {
    "armed_robbery",
    "gunshots_heard",
    "kidnapping",
}


def _to_decimal(value) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _role_weight(user) -> Decimal:
    role = getattr(getattr(user, "profile", None), "role", None)
    if role == UserRole.ADMIN:
        return Decimal("10")
    if role == UserRole.ANALYST:
        return Decimal("8")
    if role == UserRole.TRUSTED_VERIFIER:
        return Decimal("5")
    return Decimal("1")


def _source_weight(source_profile) -> Decimal:
    if not source_profile:
        return Decimal("0")

    trust_multiplier = _to_decimal(source_profile.trust_score) * Decimal("4")
    source_type_bonus = Decimal("0")
    if source_profile.source_type == SourceType.PATROL:
        source_type_bonus = Decimal("5")
    elif source_profile.source_type in {SourceType.NGO, SourceType.JOURNALIST, SourceType.CIVIC_MONITOR}:
        source_type_bonus = Decimal("2")
    return trust_multiplier + source_type_bonus


def calculate_verification_weight(signal: Signal, user, distance_meters: int | None = None) -> Decimal:
    source_profile = user.source_profiles.order_by("id").first() if getattr(user, "is_authenticated", False) else None
    weight = _role_weight(user) + _source_weight(source_profile)
    if distance_meters is not None:
        if distance_meters <= 1000:
            weight += Decimal("1.5")
        elif distance_meters <= 5000:
            weight += Decimal("0.75")
    if signal.source_profile_id and source_profile and signal.source_profile_id == source_profile.pk:
        weight = max(Decimal("0.5"), weight - Decimal("1.0"))
    return min(weight.quantize(Decimal("0.01")), Decimal("10.00"))


def build_verification_summary(signal: Signal) -> dict:
    events = list(signal.verification_events.select_related("user", "source_profile"))
    confirm_weight = sum((_to_decimal(event.weight) for event in events if event.response == VerificationResponse.CONFIRM), Decimal("0"))
    deny_weight = sum((_to_decimal(event.weight) for event in events if event.response == VerificationResponse.DENY), Decimal("0"))
    unsure_weight = sum((_to_decimal(event.weight) for event in events if event.response == VerificationResponse.UNSURE), Decimal("0"))
    confirm_count = sum(1 for event in events if event.response == VerificationResponse.CONFIRM)
    deny_count = sum(1 for event in events if event.response == VerificationResponse.DENY)
    trusted_confirmations = sum(
        1
        for event in events
        if event.response == VerificationResponse.CONFIRM and _to_decimal(event.weight) >= Decimal("5")
    )
    decisive_total = confirm_weight + deny_weight
    consensus_ratio = float((confirm_weight / decisive_total).quantize(Decimal("0.0001"))) if decisive_total > 0 else None
    return {
        "total_votes": len(events),
        "confirm_count": confirm_count,
        "deny_count": deny_count,
        "unsure_count": sum(1 for event in events if event.response == VerificationResponse.UNSURE),
        "confirm_weight": float(confirm_weight),
        "deny_weight": float(deny_weight),
        "unsure_weight": float(unsure_weight),
        "trusted_confirmations": trusted_confirmations,
        "consensus_ratio": consensus_ratio,
    }


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

    verification_summary = build_verification_summary(signal)
    confirm_weight = _to_decimal(verification_summary["confirm_weight"])
    deny_weight = _to_decimal(verification_summary["deny_weight"])
    decisive_total = confirm_weight + deny_weight
    if decisive_total > 0:
        net_consensus = (confirm_weight - deny_weight) / decisive_total
        score += net_consensus * Decimal("0.30")
        score += min(Decimal("0.15"), decisive_total * Decimal("0.015"))

    if signal.category in SENSITIVE_SIGNAL_CATEGORIES:
        confirm_count = verification_summary["confirm_count"]
        if confirm_count < 2:
            score = min(score, Decimal("0.60"))
        if confirm_count == 0 and deny_weight == 0:
            score = min(score, Decimal("0.45"))

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
        "verification_summary": build_verification_summary(signal),
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


def submit_signal_verification(
    *,
    signal: Signal,
    user,
    response: str,
    distance_meters: int | None = None,
    note: str = "",
) -> SignalVerification:
    source_profile = user.source_profiles.order_by("id").first()
    weight = calculate_verification_weight(signal, user, distance_meters)
    verification, _ = SignalVerification.objects.update_or_create(
        signal=signal,
        user=user,
        defaults={
            "source_profile": source_profile,
            "response": response,
            "weight": weight,
            "distance_meters": distance_meters,
            "note": note,
            "metadata": {
                "submitted_at": timezone.now().isoformat(),
                "role": getattr(getattr(user, "profile", None), "role", None),
            },
        },
    )
    assess_signal(signal)
    return verification
