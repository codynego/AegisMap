from decimal import Decimal
from datetime import timedelta

from django.utils import timezone

from .models import ReliabilityBand, SourceProfile


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
    score = float(source_profile.trust_score)
    if score >= 0.85:
        source_profile.reliability_band = ReliabilityBand.TRUSTED
    elif score >= 0.65:
        source_profile.reliability_band = ReliabilityBand.HIGH
    elif score >= 0.40:
        source_profile.reliability_band = ReliabilityBand.MODERATE
    else:
        source_profile.reliability_band = ReliabilityBand.LOW

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


def penalize_false_report(source_profile: SourceProfile | None, *, reason: str, restricted_days: int = 7) -> SourceProfile | None:
    if source_profile is None:
        return None

    penalty_count = int((source_profile.metadata or {}).get("false_report_penalty_count", 0)) + 1
    restricted_until = timezone.now() + timedelta(days=restricted_days)
    next_score = max(Decimal("0.05"), Decimal(source_profile.trust_score) - Decimal("0.15"))

    source_profile.trust_score = next_score.quantize(Decimal("0.01"))
    source_profile.metadata = {
        **(source_profile.metadata or {}),
        "false_report_penalty_count": penalty_count,
        "reporting_restricted_until": restricted_until.isoformat(),
        "admin_flagged": True,
        "last_false_report_reason": reason,
        "last_false_report_penalized_at": timezone.now().isoformat(),
    }

    score = float(source_profile.trust_score)
    if score >= 0.85:
        source_profile.reliability_band = ReliabilityBand.TRUSTED
    elif score >= 0.65:
        source_profile.reliability_band = ReliabilityBand.HIGH
    elif score >= 0.40:
        source_profile.reliability_band = ReliabilityBand.MODERATE
    else:
        source_profile.reliability_band = ReliabilityBand.LOW

    source_profile.save(update_fields=["trust_score", "reliability_band", "metadata", "updated_at"])
    return source_profile
