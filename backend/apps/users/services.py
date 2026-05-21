from decimal import Decimal

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
