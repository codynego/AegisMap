from collections import defaultdict

from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alerts.models import Alert
from apps.incidents.models import Incident, IncidentStatus, IncidentType
from apps.incidents.services import calculate_incident_visibility_score, should_display_incident_on_map


PUBLIC_INCIDENT_TYPES = {
    IncidentType.FLOODING,
    IncidentType.ROAD_OBSTRUCTION,
    IncidentType.ROAD_ACCIDENT,
    IncidentType.UNSAFE_ROUTE,
    IncidentType.FIRE_OUTBREAK,
}

PUBLIC_INCIDENT_STATUSES = {
    IncidentStatus.VERIFIED,
    IncidentStatus.ACTIVE,
    IncidentStatus.RESOLVED,
}
# For public views we require at least `probable` tier (visibility_score >= 0.6)
def _confidence_tier_from_visibility(score: float) -> str:
    try:
        if isinstance(score, (int, float)):
            if score >= 0.8:
                return "verified"
            if score >= 0.6:
                return "probable"
            if score >= 0.3:
                return "emerging"
    except Exception:
        pass
    return "raw"


def _public_location_label(state: str, fallback: str = "") -> str:
    if state:
        return f"{state} area"
    if fallback:
        return "General area"
    return "Area withheld"


def _serialize_public_incident(incident: Incident) -> dict:
    state = _location_state_for_incident(incident)
    visibility_score = calculate_incident_visibility_score(incident)
    return {
        "id": incident.pk,
        "title": incident.title,
        "incident_type": incident.incident_type,
        "severity": incident.severity,
        "confidence_tier": _confidence_tier_from_visibility(visibility_score),
        "visibility_score": visibility_score,
        "location_name": _public_location_label(state, incident.location_name),
        "location_state": state,
        "latitude": _round_coordinate(incident.latitude, 1),
        "longitude": _round_coordinate(incident.longitude, 1),
        "detected_at": incident.detected_at,
        "summary": incident.summary,
    }


def _serialize_public_alert(alert: Alert) -> dict:
    metadata = alert.metadata or {}
    state = metadata.get("location_state") or ""
    incident = getattr(alert, "incident", None)
    incident_confidence = None
    if incident is not None:
        try:
            incident_confidence = _confidence_tier_from_visibility(calculate_incident_visibility_score(incident))
        except Exception:
            incident_confidence = None

    return {
        "id": alert.pk,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "message": alert.message,
        "location_name": _public_location_label(state, metadata.get("location_name", "")),
        "location_state": state,
        "location_latitude": _round_coordinate(
            metadata.get("location_latitude") or (incident.latitude if incident is not None else None),
            1,
        ),
        "location_longitude": _round_coordinate(
            metadata.get("location_longitude") or (incident.longitude if incident is not None else None),
            1,
        ),
        "triggered_at": alert.triggered_at,
        "incident_confidence_tier": incident_confidence,
    }
    


def _route_label_for_incident(incident: Incident) -> str:
    primary_signal = getattr(incident, "primary_signal", None)
    route_hint = (getattr(primary_signal, "route_hint", "") or "").strip()
    if route_hint:
        return route_hint

    state = _location_state_for_incident(incident)
    if state:
        return f"{state} corridors"

    return "General route advisory"


def _route_risk_level(incident_count: int, highest_severity: str) -> str:
    if highest_severity == "critical" or incident_count >= 4:
        return "High"
    if highest_severity == "high" or incident_count >= 2:
        return "Moderate"
    return "Guarded"


class PublicSafetySummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        state = (request.query_params.get("state") or "").strip()

        incidents = (
            Incident.objects.select_related("primary_signal")
                .filter(
                    incident_type__in=PUBLIC_INCIDENT_TYPES,
                    status__in=PUBLIC_INCIDENT_STATUSES,
                )
                .order_by("-detected_at")
        )
        if state:
            incidents = incidents.filter(
                Q(metadata__location_state__iexact=state)
                | Q(primary_signal__metadata__location_state__iexact=state)
            )

        # Compute visibility and tier per-incident and filter to public tiers
        safe_incidents = []
        for incident in incidents:
            if (incident.metadata or {}).get("hidden_from_map"):
                continue
            if not should_display_incident_on_map(incident):
                continue
            visibility_score = calculate_incident_visibility_score(incident)
            tier = _confidence_tier_from_visibility(visibility_score)
            if tier in PUBLIC_CONFIDENCE_TIERS:
                safe_incidents.append(incident)

        alerts = (
            Alert.objects.select_related("incident")
            .filter(
                severity__in=PUBLIC_ALERT_SEVERITIES,
                status__in=PUBLIC_ALERT_STATUSES,
            )
            .exclude(status__in=["dismissed", "suppressed"])
            .exclude(
                incident__incident_type__in=[
                    IncidentType.ARMED_ROBBERY,
                    IncidentType.KIDNAPPING,
                    IncidentType.GUNSHOTS_HEARD,
                    IncidentType.MEDICAL_EMERGENCY,
                    IncidentType.SUSPICIOUS_ACTIVITY,
                ]
            )
            .order_by("-triggered_at")
        )
        if state:
            alerts = alerts.filter(
                Q(metadata__location_state__iexact=state)
                | Q(incident__metadata__location_state__iexact=state)
                | Q(incident__primary_signal__metadata__location_state__iexact=state)
            )

        serialized_incidents = [_serialize_public_incident(incident) for incident in safe_incidents[:60]]
        serialized_alerts = [_serialize_public_alert(alert) for alert in alerts[:12]]

        route_groups: dict[str, dict] = defaultdict(
            lambda: {"incident_count": 0, "highest_severity": "low", "states": set(), "updated_at": None}
        )
        severity_rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        for incident in safe_incidents:
            route_name = _route_label_for_incident(incident)
            group = route_groups[route_name]
            group["incident_count"] += 1
            if severity_rank.get(incident.severity, 0) > severity_rank.get(group["highest_severity"], 0):
                group["highest_severity"] = incident.severity
            state_name = _location_state_for_incident(incident)
            if state_name:
                group["states"].add(state_name)
            group["updated_at"] = max(
                [value for value in [group["updated_at"], incident.detected_at] if value],
                default=incident.detected_at,
            )

        route_advisories = [
            {
                "id": index + 1,
                "route_name": route_name,
                "risk_level": _route_risk_level(group["incident_count"], group["highest_severity"]),
                "incident_count": group["incident_count"],
                "states": sorted(group["states"]),
                "summary": (
                    f"{group['incident_count']} verified public-safety signal"
                    f"{'' if group['incident_count'] == 1 else 's'} affecting this corridor."
                ),
                "updated_at": group["updated_at"],
            }
            for index, (route_name, group) in enumerate(
                sorted(
                    route_groups.items(),
                    key=lambda item: (
                        severity_rank.get(item[1]["highest_severity"], 0),
                        item[1]["incident_count"],
                    ),
                    reverse=True,
                )[:8]
            )
        ]

        today = timezone.localdate()
        verified_incidents_today = sum(
            1 for incident in safe_incidents if timezone.localtime(incident.detected_at).date() == today
        )
        active_alerts = sum(1 for alert in serialized_alerts if alert["status"] != "resolved")
        covered_states = sorted(
            {
                state_name
                for incident in safe_incidents
                for state_name in [_location_state_for_incident(incident)]
                if state_name
            }
        )

        return Response(
            {
                "generated_at": timezone.now(),
                "incidents": serialized_incidents,
                "alerts": serialized_alerts,
                "route_advisories": route_advisories,
                "stats": {
                    "active_alerts": active_alerts,
                    "verified_incidents_today": verified_incidents_today,
                    "monitored_routes": len(route_advisories),
                    "states_covered": len(covered_states),
                },
            }
        )
