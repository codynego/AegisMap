from decimal import Decimal
from datetime import timedelta

from django.utils import timezone

from .models import ReliabilityBand, SourceProfile


FALSE_REPORT_COOLDOWN_THRESHOLD = 3
FALSE_REPORT_COOLDOWN_DAYS = 7


def _apply_reliability_band(source_profile: SourceProfile) -> None:
    score = float(source_profile.trust_score)
    if score >= 0.85:
        source_profile.reliability_band = ReliabilityBand.TRUSTED
    elif score >= 0.65:
        source_profile.reliability_band = ReliabilityBand.HIGH
    elif score >= 0.40:
        source_profile.reliability_band = ReliabilityBand.MODERATE
    else:
        source_profile.reliability_band = ReliabilityBand.LOW


def update_source_statistics(source_profile: SourceProfile) -> SourceProfile:
    signals = source_profile.signals.all()
    report_count = signals.count()
    verified_signal_count = signals.filter(confidence__in=["corroborated", "high"]).count()
    disputed_signal_count = signals.filter(confidence="disputed").count()

    source_profile.report_count = report_count
    source_profile.verified_signal_count = verified_signal_count
    source_profile.disputed_signal_count = disputed_signal_count

    if report_count == 0:
        trust_score = Decimal("0.50")
    else:
        positive_ratio = Decimal(verified_signal_count) / Decimal(report_count)
        dispute_penalty = Decimal(disputed_signal_count) / Decimal(report_count)
        trust_score = Decimal("0.35") + (positive_ratio * Decimal("0.65")) - (
            dispute_penalty * Decimal("0.40")
        )
        trust_score = max(Decimal("0.05"), min(Decimal("1.00"), trust_score))

    source_profile.trust_score = trust_score.quantize(Decimal("0.01"))
    _apply_reliability_band(source_profile)

    source_profile.save(
        update_fields=[
            "report_count",
            "verified_signal_count",
            "disputed_signal_count",
            "trust_score",
            "reliability_band",
            "updated_at",
        ]
    )
    return source_profile


def is_user_temporarily_restricted(user) -> bool:
    profile = getattr(user, "profile", None)
    if profile is None:
        return False
    restricted_until = (profile.metadata or {}).get("reporting_restricted_until")
    if not restricted_until:
        return False
    try:
        restricted_until_dt = timezone.datetime.fromisoformat(restricted_until)
    except (TypeError, ValueError):
        return False
    if timezone.is_naive(restricted_until_dt):
        restricted_until_dt = timezone.make_aware(restricted_until_dt, timezone.get_current_timezone())
    return restricted_until_dt > timezone.now()


def penalize_false_report(source_profile: SourceProfile | None, *, reason: str, restricted_days: int = FALSE_REPORT_COOLDOWN_DAYS) -> SourceProfile | None:
    if source_profile is None:
        return None

    penalty_count = int((source_profile.metadata or {}).get("false_report_penalty_count", 0)) + 1
    penalty_step = Decimal("0.10") if penalty_count == 1 else Decimal("0.15")
    next_score = max(Decimal("0.05"), Decimal(source_profile.trust_score) - penalty_step)
    metadata = {
        **(source_profile.metadata or {}),
        "false_report_penalty_count": penalty_count,
        "last_false_report_reason": reason,
        "last_false_report_penalized_at": timezone.now().isoformat(),
        "trust_reduction_applied": str(penalty_step),
    }

    if penalty_count >= FALSE_REPORT_COOLDOWN_THRESHOLD:
        restricted_until = timezone.now() + timedelta(days=restricted_days)
        metadata["reporting_restricted_until"] = restricted_until.isoformat()
        metadata["admin_flagged"] = True
        metadata["false_report_status"] = "cooldown"
    else:
        metadata.pop("reporting_restricted_until", None)
        metadata.pop("admin_flagged", None)
        metadata["false_report_status"] = "trust_reduced"

    source_profile.trust_score = next_score.quantize(Decimal("0.01"))
    source_profile.metadata = metadata
    _apply_reliability_band(source_profile)

    source_profile.save(update_fields=["trust_score", "reliability_band", "metadata", "updated_at"])
    return source_profile
