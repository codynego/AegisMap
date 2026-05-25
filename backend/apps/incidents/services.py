from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit_logs.services import record_audit_event
from apps.signals.models import ConfidenceLevel, SeverityLevel, Signal, SignalStatus

from .models import Incident, IncidentStatus, IncidentType, Pattern, PatternStatus, SignalCluster


CONFIDENCE_RANK = {
    ConfidenceLevel.RAW: 0,
    ConfidenceLevel.LOW: 1,
    ConfidenceLevel.EMERGING: 2,
    ConfidenceLevel.CORROBORATED: 3,
    ConfidenceLevel.HIGH: 4,
    ConfidenceLevel.DISPUTED: -1,
}

SEVERITY_RANK = {
    SeverityLevel.LOW: 1,
    SeverityLevel.MEDIUM: 2,
    SeverityLevel.HIGH: 3,
    SeverityLevel.CRITICAL: 4,
}

EARTH_METERS_PER_DEGREE = Decimal("111111")
DUPLICATE_RADIUS_METERS = 250
DUPLICATE_TIME_WINDOW_SECONDS = 45 * 60
SENSITIVE_INCIDENT_TYPES = {
    IncidentType.ARMED_ROBBERY,
    IncidentType.KIDNAPPING,
}
DECAY_VISIBLE_HOURS = 24 * 14


def _distance_within(signal_a: Signal, signal_b: Signal, radius_meters: int) -> bool:
    if (
        signal_a.latitude is None
        or signal_a.longitude is None
        or signal_b.latitude is None
        or signal_b.longitude is None
    ):
        return False
    radius_degrees = Decimal(str(radius_meters)) / EARTH_METERS_PER_DEGREE
    lat_delta = abs(Decimal(signal_a.latitude) - Decimal(signal_b.latitude))
    lon_delta = abs(Decimal(signal_a.longitude) - Decimal(signal_b.longitude))
    return lat_delta <= radius_degrees and lon_delta <= radius_degrees


def _time_delta_within(signal_a: Signal, signal_b: Signal, window_seconds: int) -> bool:
    timestamp_a = signal_a.occurred_at or signal_a.received_at
    timestamp_b = signal_b.occurred_at or signal_b.received_at
    if not timestamp_a or not timestamp_b:
        return False
    delta = abs(timestamp_a - timestamp_b)
    return delta.total_seconds() <= window_seconds


def _location_name_matches(signal_a: Signal, signal_b: Signal) -> bool:
    location_a = (signal_a.location_name or "").strip().casefold()
    location_b = (signal_b.location_name or "").strip().casefold()
    return bool(location_a and location_b and location_a == location_b)


def find_duplicate_signal(signal: Signal) -> Signal | None:
    queryset = (
        Signal.objects.exclude(pk=signal.pk)
        .filter(category=signal.category, status__in=[SignalStatus.TRIAGED, SignalStatus.CLUSTERED, SignalStatus.ESCALATED])
        .order_by("-received_at")
    )
    for candidate in queryset[:50]:
        if not _location_name_matches(signal, candidate):
            continue
        if not _time_delta_within(signal, candidate, DUPLICATE_TIME_WINDOW_SECONDS):
            continue
        if _distance_within(signal, candidate, DUPLICATE_RADIUS_METERS):
            return candidate
    return None


def resolve_canonical_signal(signal: Signal) -> Signal:
    current = signal
    visited = {signal.pk}
    while True:
        duplicate_of = current.metadata.get("duplicate_of")
        if not duplicate_of:
            return current
        try:
            next_signal = Signal.objects.get(pk=duplicate_of)
        except Signal.DoesNotExist:
            return current
        if next_signal.pk in visited:
            return current
        visited.add(next_signal.pk)
        current = next_signal


@transaction.atomic
def auto_merge_duplicate_signal(signal: Signal, duplicate: Signal) -> Signal:
    canonical_signal = resolve_canonical_signal(duplicate)
    merged_at = timezone.now().isoformat()
    signal.status = SignalStatus.DISMISSED
    signal.cluster = canonical_signal.cluster or signal.cluster
    signal.metadata = {
        **signal.metadata,
        "duplicate_of": str(canonical_signal.pk),
        "auto_merged": True,
        "merged_at": merged_at,
        "merge_reason": "automatic_duplicate_detection",
    }
    signal.save(update_fields=["status", "cluster", "metadata", "updated_at"])

    duplicate_ids = canonical_signal.metadata.get("duplicate_signal_ids", [])
    duplicate_ids = [*duplicate_ids, str(signal.pk)] if str(signal.pk) not in duplicate_ids else duplicate_ids
    canonical_signal.metadata = {
        **canonical_signal.metadata,
        "duplicate_signal_ids": duplicate_ids,
        "duplicate_report_count": len(duplicate_ids),
        "last_auto_merged_duplicate_at": merged_at,
    }
    canonical_signal.save(update_fields=["metadata", "updated_at"])

    record_audit_event(
        "signal.auto_merged_duplicate",
        obj=signal,
        description=f"Signal '{signal.title}' auto-merged into '{canonical_signal.title}'.",
        metadata={"target_signal_id": str(canonical_signal.pk)},
    )
    return canonical_signal


def _calculate_cluster_centroid(signals):
    located = [s for s in signals if s.latitude is not None and s.longitude is not None]
    if not located:
        return None, None
    lat_total = sum(Decimal(str(signal.latitude)) for signal in located)
    lon_total = sum(Decimal(str(signal.longitude)) for signal in located)
    count = Decimal(len(located))
    return (lat_total / count).quantize(Decimal("0.000001")), (
        lon_total / count
    ).quantize(Decimal("0.000001"))


def _highest_confidence(signals) -> str:
    return max(signals, key=lambda item: CONFIDENCE_RANK.get(item.confidence, 0)).confidence


def _highest_severity(signals) -> str:
    return max(signals, key=lambda item: SEVERITY_RANK.get(item.severity, 0)).severity


@transaction.atomic
def upsert_cluster_for_signal(signal: Signal) -> SignalCluster | None:
    related_signals = []
    queryset = (
        Signal.objects.exclude(pk=signal.pk)
        .filter(category=signal.category)
        .exclude(status=SignalStatus.DISMISSED)
        .order_by("-received_at")
    )
    for candidate in queryset[:100]:
        if signal.occurred_at and candidate.occurred_at:
            delta = abs(signal.occurred_at - candidate.occurred_at)
            if delta.total_seconds() > 72 * 3600:
                continue
        if _distance_within(signal, candidate, 5000):
            related_signals.append(candidate)

    if not related_signals:
        return None

    existing_cluster = next((candidate.cluster for candidate in related_signals if candidate.cluster_id), None)
    cluster = existing_cluster or SignalCluster.objects.create(
        name=f"{signal.get_category_display()} cluster",
        cluster_type="proximity",
        started_at=signal.occurred_at or timezone.now(),
        radius_meters=5000,
    )
    members = list({signal, *related_signals})
    centroid_latitude, centroid_longitude = _calculate_cluster_centroid(members)
    cluster.centroid_latitude = centroid_latitude
    cluster.centroid_longitude = centroid_longitude
    cluster.last_seen_at = timezone.now()
    cluster.confidence = _highest_confidence(members)
    cluster.status = (
        PatternStatus.ESCALATED
        if cluster.confidence in {ConfidenceLevel.CORROBORATED, ConfidenceLevel.HIGH}
        else PatternStatus.MONITORING
    )
    cluster.summary = f"{len(members)} related signals detected for {signal.get_category_display().lower()}."
    cluster.metadata = {**cluster.metadata, "signal_count": len(members)}
    cluster.save()

    Signal.objects.filter(pk__in=[member.pk for member in members]).update(
        cluster=cluster,
        status=SignalStatus.CLUSTERED,
    )
    return cluster


@transaction.atomic
def sync_pattern_for_cluster(cluster: SignalCluster) -> Pattern:
    signals = list(cluster.signals.all())
    severity = _highest_severity(signals)
    confidence = _highest_confidence(signals)
    pattern, _ = Pattern.objects.get_or_create(
        cluster=cluster,
        defaults={
            "name": f"{cluster.name} pattern",
            "summary": cluster.summary,
        },
    )
    pattern.confidence = confidence
    pattern.severity = severity
    pattern.status = (
        PatternStatus.ESCALATED
        if len(signals) >= 3 or confidence in {ConfidenceLevel.CORROBORATED, ConfidenceLevel.HIGH}
        else PatternStatus.EMERGING
    )
    pattern.geographic_hint = signals[0].location_name if signals else pattern.geographic_hint
    pattern.centroid_latitude = cluster.centroid_latitude
    pattern.centroid_longitude = cluster.centroid_longitude
    pattern.first_detected_at = pattern.first_detected_at or cluster.started_at or timezone.now()
    pattern.last_detected_at = timezone.now()
    pattern.summary = cluster.summary
    pattern.metadata = {
        **pattern.metadata,
        "signal_count": len(signals),
        "category": signals[0].category if signals else None,
    }
    pattern.save()
    return pattern


@transaction.atomic
def promote_pattern_to_incident(pattern: Pattern) -> Incident | None:
    cluster = pattern.cluster
    signals = list(cluster.signals.all()) if cluster else []
    if not signals:
        return None

    primary_category = signals[0].category
    sensitive_signal = primary_category in {"armed_robbery", "gunshots_heard", "kidnapping"}
    should_promote = (
        len(signals) >= 3
        or pattern.confidence in {ConfidenceLevel.CORROBORATED, ConfidenceLevel.HIGH}
        or (
            not sensitive_signal
            and any(signal.severity in {SeverityLevel.HIGH, SeverityLevel.CRITICAL} for signal in signals)
        )
    )
    if not should_promote:
        return None

    primary_signal = sorted(
        signals,
        key=lambda item: (
            SEVERITY_RANK.get(item.severity, 0),
            CONFIDENCE_RANK.get(item.confidence, 0),
        ),
        reverse=True,
    )[0]

    incident = Incident.objects.filter(pattern=pattern).first()
    if incident is None:
        incident = (
            Incident.objects.filter(primary_signal__in=signals)
            .exclude(status=IncidentStatus.ARCHIVED)
            .order_by("created_at")
            .first()
        )
    if incident is None:
        incident = Incident.objects.create(
            pattern=pattern,
            title=f"{primary_signal.get_category_display()} incident",
            primary_signal=primary_signal,
        )
    else:
        incident.pattern = pattern
    incident.primary_signal = primary_signal
    incident.incident_type = _map_signal_category_to_incident_type(primary_signal.category)
    incident.confidence = pattern.confidence
    incident.severity = pattern.severity
    incident.location_name = primary_signal.location_name
    incident.latitude = primary_signal.latitude
    incident.longitude = primary_signal.longitude
    incident.started_at = primary_signal.occurred_at or incident.started_at
    incident.summary = pattern.summary
    incident.metadata = {
        **incident.metadata,
        "pattern_id": pattern.pk,
        "signal_count": len(signals),
        "duplicate_report_count": _duplicate_report_count(signals),
        "last_reconfirmed_at": timezone.now().isoformat(),
        "decay_started_at": incident.metadata.get("decay_started_at") or timezone.now().isoformat(),
    }
    incident.status = derive_incident_status(
        incident_type=incident.incident_type,
        signal_count=len(signals),
        confidence=incident.confidence,
        severity=incident.severity,
        verification_summary=primary_signal.metadata.get("verification_summary", {}),
        admin_verified=bool(incident.metadata.get("manually_verified_by")),
        resolved=incident.status == IncidentStatus.RESOLVED,
        archived=incident.status == IncidentStatus.ARCHIVED,
        promoted=True,
    )
    incident.save()

    Signal.objects.filter(pk__in=[signal.pk for signal in signals]).update(status=SignalStatus.ESCALATED)
    pattern.status = PatternStatus.ESCALATED
    pattern.save(update_fields=["status", "updated_at"])
    Incident.objects.filter(primary_signal__in=signals).exclude(pk=incident.pk).update(
        status=IncidentStatus.ARCHIVED,
        resolved_at=timezone.now(),
    )
    record_audit_event(
        "incident.promoted",
        obj=incident,
        description=f"Pattern '{pattern.name}' promoted to incident '{incident.title}'.",
        metadata={"pattern_id": pattern.pk, "signal_count": len(signals)},
    )
    return incident


def process_signal_intelligence(signal: Signal) -> dict:
    duplicate = find_duplicate_signal(signal)
    if duplicate:
        duplicate = auto_merge_duplicate_signal(signal, duplicate)
        return {
            "duplicate": duplicate,
            "cluster": duplicate.cluster if duplicate.cluster_id else None,
            "pattern": None,
            "incident": None,
        }

    cluster = upsert_cluster_for_signal(signal)
    pattern = None
    incident = None
    if cluster:
        signal.refresh_from_db(fields=["cluster", "status"])
        pattern = sync_pattern_for_cluster(cluster)
        incident = promote_pattern_to_incident(pattern)

    return {
        "duplicate": duplicate,
        "cluster": cluster,
        "pattern": pattern,
        "incident": incident,
    }


def _duplicate_report_count(signals: list[Signal]) -> int:
    total = 0
    for signal in signals:
        duplicates = signal.metadata.get("duplicate_signal_ids", [])
        total += max(1, len(duplicates) + 1)
    return total


def build_incident_verification_summary(events: list[dict]) -> dict:
    confirm_weight = sum(float(event.get("weight", 0) or 0) for event in events if event.get("response") == "confirm")
    deny_weight = sum(float(event.get("weight", 0) or 0) for event in events if event.get("response") == "deny")
    unsure_weight = sum(float(event.get("weight", 0) or 0) for event in events if event.get("response") == "unsure")
    confirm_count = sum(1 for event in events if event.get("response") == "confirm")
    deny_count = sum(1 for event in events if event.get("response") == "deny")
    unsure_count = sum(1 for event in events if event.get("response") == "unsure")
    trusted_confirmations = sum(
        1
        for event in events
        if event.get("response") == "confirm" and float(event.get("weight", 0) or 0) >= 5
    )
    decisive = confirm_weight + deny_weight
    consensus_ratio = round(confirm_weight / decisive, 4) if decisive > 0 else None
    return {
        "total_votes": len(events),
        "confirm_count": confirm_count,
        "deny_count": deny_count,
        "unsure_count": unsure_count,
        "confirm_weight": confirm_weight,
        "deny_weight": deny_weight,
        "unsure_weight": unsure_weight,
        "trusted_confirmations": trusted_confirmations,
        "consensus_ratio": consensus_ratio,
    }


def _map_incident_score_to_confidence(score: float) -> str:
    if score >= 0.85:
        return ConfidenceLevel.HIGH
    if score >= 0.65:
        return ConfidenceLevel.CORROBORATED
    if score >= 0.45:
        return ConfidenceLevel.EMERGING
    if score >= 0.25:
        return ConfidenceLevel.LOW
    return ConfidenceLevel.RAW


def calculate_incident_confidence_score(incident: Incident, verification_summary: dict) -> float:
    metadata = incident.metadata or {}
    primary_signal = incident.primary_signal

    base_score = metadata.get("confidence_score")
    if not isinstance(base_score, (int, float)) and primary_signal is not None:
        signal_score = (primary_signal.metadata or {}).get("confidence_score")
        if isinstance(signal_score, (int, float)):
            base_score = float(signal_score)

    if not isinstance(base_score, (int, float)):
        base_score = {
            ConfidenceLevel.HIGH: 0.9,
            ConfidenceLevel.CORROBORATED: 0.72,
            ConfidenceLevel.EMERGING: 0.55,
            ConfidenceLevel.LOW: 0.35,
            ConfidenceLevel.RAW: 0.2,
        }.get(incident.confidence, 0.2)

    confirm_weight = float(verification_summary.get("confirm_weight", 0) or 0)
    deny_weight = float(verification_summary.get("deny_weight", 0) or 0)
    decisive_total = confirm_weight + deny_weight
    if decisive_total > 0:
        net_consensus = (confirm_weight - deny_weight) / decisive_total
        base_score += net_consensus * 0.18
        base_score += min(0.12, decisive_total * 0.012)

    confirm_count = int(verification_summary.get("confirm_count", 0) or 0)
    if incident.incident_type in SENSITIVE_INCIDENT_TYPES and confirm_count < 2:
        base_score = min(base_score, 0.6)

    return max(0.0, min(1.0, round(base_score, 4)))


def derive_incident_status(
    *,
    incident_type: str,
    signal_count: int,
    confidence: str,
    severity: str,
    verification_summary: dict,
    admin_verified: bool = False,
    resolved: bool = False,
    archived: bool = False,
    promoted: bool = False,
) -> str:
    if archived:
        return IncidentStatus.ARCHIVED
    if resolved:
        return IncidentStatus.RESOLVED
    if admin_verified:
        return IncidentStatus.ACTIVE if severity in {SeverityLevel.HIGH, SeverityLevel.CRITICAL} or promoted else IncidentStatus.VERIFIED

    trusted_confirmations = int(verification_summary.get("trusted_confirmations", 0) or 0)
    confirm_count = int(verification_summary.get("confirm_count", 0) or 0)
    confirm_weight = float(verification_summary.get("confirm_weight", 0) or 0)

    if incident_type in SENSITIVE_INCIDENT_TYPES:
        if signal_count >= 2 or trusted_confirmations >= 2 or confirm_weight >= 9:
            return IncidentStatus.ACTIVE if severity in {SeverityLevel.HIGH, SeverityLevel.CRITICAL} or promoted else IncidentStatus.VERIFIED
        if signal_count >= 1 or confirm_count >= 1 or confidence in {ConfidenceLevel.EMERGING, ConfidenceLevel.CORROBORATED}:
            return IncidentStatus.PROBABLE
        return IncidentStatus.UNCONFIRMED

    if signal_count >= 3 or confidence == ConfidenceLevel.HIGH or trusted_confirmations >= 2:
        return IncidentStatus.ACTIVE if severity in {SeverityLevel.HIGH, SeverityLevel.CRITICAL} or promoted else IncidentStatus.VERIFIED
    if signal_count >= 2 or confidence == ConfidenceLevel.CORROBORATED or confirm_weight >= 5:
        return IncidentStatus.PROBABLE
    return IncidentStatus.UNCONFIRMED


def recompute_incident_state(incident: Incident) -> Incident:
    primary_signal = incident.primary_signal
    metadata = incident.metadata or {}
    verification_summary = metadata.get("verification_summary", {}) if isinstance(metadata.get("verification_summary", {}), dict) else {}
    signal_count = int(metadata.get("signal_count", 1) or 1)
    if primary_signal is not None:
        signal_summary = (primary_signal.metadata or {}).get("verification_summary", {})
        if not verification_summary and isinstance(signal_summary, dict):
            verification_summary = signal_summary
        if primary_signal.cluster_id:
            signal_count = max(signal_count, primary_signal.cluster.signals.exclude(status=SignalStatus.DISMISSED).count())

    confidence_score = calculate_incident_confidence_score(incident, verification_summary)
    incident.confidence = _map_incident_score_to_confidence(confidence_score)

    incident.status = derive_incident_status(
        incident_type=incident.incident_type,
        signal_count=signal_count,
        confidence=incident.confidence,
        severity=incident.severity,
        verification_summary=verification_summary,
        admin_verified=bool((incident.metadata or {}).get("manually_verified_by")),
        resolved=incident.status == IncidentStatus.RESOLVED,
        archived=incident.status == IncidentStatus.ARCHIVED,
        promoted=bool(incident.pattern_id),
    )
    if incident.status in {IncidentStatus.VERIFIED, IncidentStatus.ACTIVE, IncidentStatus.RESOLVED}:
        if not (incident.metadata or {}).get("decay_started_at"):
            incident.metadata = {
                **(incident.metadata or {}),
                "decay_started_at": timezone.now().isoformat(),
            }
    incident.metadata = {
        **(incident.metadata or {}),
        "signal_count": signal_count,
        "confidence_score": confidence_score,
        "verification_summary": verification_summary,
        "last_status_evaluated_at": timezone.now().isoformat(),
    }
    incident.save(update_fields=["confidence", "status", "metadata", "updated_at"])
    return incident


def recompute_incident_state_for_signal(signal: Signal) -> None:
    for incident in Incident.objects.filter(primary_signal=signal):
        recompute_incident_state(incident)


def calculate_incident_visibility_score(incident: Incident) -> float:
    metadata = incident.metadata or {}
    if metadata.get("hidden_from_map"):
        return 0.0
    if incident.status == IncidentStatus.ARCHIVED:
        return 0.0

    if incident.status in {IncidentStatus.UNCONFIRMED, IncidentStatus.PROBABLE}:
        return 1.0

    decay_anchor_raw = metadata.get("last_reconfirmed_at") or metadata.get("decay_started_at")
    if not decay_anchor_raw:
        return 1.0

    try:
        decay_anchor = timezone.datetime.fromisoformat(decay_anchor_raw)
    except (TypeError, ValueError):
        return 1.0
    if timezone.is_naive(decay_anchor):
        decay_anchor = timezone.make_aware(decay_anchor, timezone.get_current_timezone())

    hours = max(0.0, (timezone.now() - decay_anchor).total_seconds() / 3600)
    if hours >= DECAY_VISIBLE_HOURS:
        return 0.0

    remaining = 1 - (hours / DECAY_VISIBLE_HOURS)
    if hours <= 6:
        return 1.0
    if hours <= 24:
        return 0.92
    if hours <= 72:
        return 0.76
    if hours <= 24 * 7:
        return 0.48
    return round(max(0.0, remaining * 0.3), 4)


def should_display_incident_on_map(incident: Incident) -> bool:
    return calculate_incident_visibility_score(incident) > 0


def _map_signal_category_to_incident_type(category: str) -> str:
    mapping = {
        "suspicious_activity": IncidentType.SUSPICIOUS_ACTIVITY,
        "road_accident": IncidentType.ROAD_ACCIDENT,
        "kidnapping": IncidentType.KIDNAPPING,
        "armed_robbery": IncidentType.ARMED_ROBBERY,
        "fire_outbreak": IncidentType.FIRE_OUTBREAK,
        "road_obstruction": IncidentType.ROAD_OBSTRUCTION,
        "flooding": IncidentType.FLOODING,
        "medical_emergency": IncidentType.MEDICAL_EMERGENCY,
        "gunshots_heard": IncidentType.GUNSHOTS_HEARD,
        "unsafe_route": IncidentType.UNSAFE_ROUTE,
        "suspicious_movement": IncidentType.SUSPICIOUS_ACTIVITY,
        "abnormal_sighting": IncidentType.SUSPICIOUS_ACTIVITY,
        "camp_indicator": IncidentType.SUSPICIOUS_ACTIVITY,
        "tip": IncidentType.SUSPICIOUS_ACTIVITY,
        "other": IncidentType.SUSPICIOUS_ACTIVITY,
        "violence": IncidentType.GUNSHOTS_HEARD,
        "road_threat": IncidentType.UNSAFE_ROUTE,
        "road_blockade": IncidentType.ROAD_OBSTRUCTION,
        "fire_smoke": IncidentType.FIRE_OUTBREAK,
        "fire": IncidentType.FIRE_OUTBREAK,
        "flood": IncidentType.FLOODING,
    }
    return mapping.get(category, IncidentType.SUSPICIOUS_ACTIVITY)
