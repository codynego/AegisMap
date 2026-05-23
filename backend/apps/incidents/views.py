from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite
from apps.users.permissions import is_analyst_or_admin, get_user_role
from apps.users.models import UserRole

from .models import Incident, Pattern, SignalCluster
from .serializers import IncidentSerializer, PatternSerializer, SignalClusterSerializer
from .services import promote_pattern_to_incident


class SignalClusterViewSet(viewsets.ModelViewSet):
    serializer_class = SignalClusterSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = SignalCluster.objects.annotate(signal_count=Count("signals")).order_by(
        "-updated_at"
    )

    def get_queryset(self):
        queryset = self.queryset
        cluster_type = self.request.query_params.get("cluster_type")
        confidence = self.request.query_params.get("confidence")
        status_value = self.request.query_params.get("status")

        if cluster_type:
            queryset = queryset.filter(cluster_type=cluster_type)
        if confidence:
            queryset = queryset.filter(confidence=confidence)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class PatternViewSet(viewsets.ModelViewSet):
    serializer_class = PatternSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Pattern.objects.select_related("cluster")

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        confidence = self.request.query_params.get("confidence")

        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)
        if confidence:
            queryset = queryset.filter(confidence=confidence)

        return queryset

    @action(detail=True, methods=["post"])
    def promote(self, request, pk=None):
        pattern = self.get_object()
        incident = promote_pattern_to_incident(pattern)
        if incident is None:
            return Response(
                {"detail": "Pattern does not yet meet incident promotion criteria."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record_audit_event(
            "pattern.promoted",
            actor=request.user,
            obj=pattern,
            request=request,
            description=f"Pattern '{pattern.name}' promoted to incident.",
            metadata={"incident_id": incident.pk},
        )
        return Response(IncidentSerializer(incident, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        pattern = self.get_object()
        pattern.status = "resolved"
        pattern.last_detected_at = timezone.now()
        pattern.save(update_fields=["status", "last_detected_at", "updated_at"])
        record_audit_event(
            "pattern.resolved",
            actor=request.user,
            obj=pattern,
            request=request,
            description=f"Pattern '{pattern.name}' resolved.",
        )
        return Response(self.get_serializer(pattern).data)


class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Incident.objects.select_related("pattern", "primary_signal")

    def get_queryset(self):
        queryset = self.queryset
        incident_type = self.request.query_params.get("incident_type")
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        confidence = self.request.query_params.get("confidence")

        if incident_type:
            queryset = queryset.filter(incident_type=incident_type)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)
        if confidence:
            queryset = queryset.filter(confidence=confidence)

        # filter by administrative state (metadata or related objects may store location_state)
        state = (self.request.query_params.get("state") or "").strip()
        if state:
            queryset = queryset.filter(
                Q(metadata__location_state__iexact=state)
                | Q(pattern__metadata__location_state__iexact=state)
                | Q(primary_signal__metadata__location_state__iexact=state)
                | Q(location_name__icontains=state)
            )

        # support verification queue for analysts: when requested, return incidents needing confirmation
        verification_queue = self.request.query_params.get("verification_queue") == "true"
        if verification_queue and is_analyst_or_admin(self.request.user):
            queryset = queryset.filter(confidence__in=["raw", "low", "emerging", "corroborated"]).exclude(status="dismissed")
        elif not is_analyst_or_admin(self.request.user):
            queryset = queryset.filter(confidence__in=["corroborated", "high"]).exclude(status="dismissed")

        return queryset

    @action(detail=True, methods=["post"])
    def monitor(self, request, pk=None):
        incident = self.get_object()
        incident.status = "monitoring"
        incident.save(update_fields=["status", "updated_at"])
        record_audit_event(
            "incident.monitoring",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' moved to monitoring.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        incident = self.get_object()
        incident.status = "resolved"
        incident.resolved_at = timezone.now()
        incident.save(update_fields=["status", "resolved_at", "updated_at"])
        record_audit_event(
            "incident.resolved",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' resolved.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Admin-only: mark incident as approved/high-confidence."""
        # permit only admins to approve
        if get_user_role(request.user) != UserRole.ADMIN.value:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)

        incident = self.get_object()
        # set high confidence and open status
        incident.confidence = "high"
        incident.status = "open"
        incident.metadata = {**incident.metadata, "approved_by": request.user.username if request.user and request.user.is_authenticated else None, "approved_at": timezone.now().isoformat()}
        incident.save(update_fields=["confidence", "status", "metadata", "updated_at"])
        record_audit_event(
            "incident.approved",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' approved by admin.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def submit_verification(self, request, pk=None):
        """Allow analysts/admins to submit a verification vote for an incident.

        Stores a lightweight verification event in incident.metadata.verification_events
        and updates metadata.verification_summary (counts & simple consensus ratio).
        """
        if not is_analyst_or_admin(request.user):
            return Response({"detail": "Analysts only."}, status=status.HTTP_403_FORBIDDEN)

        incident = self.get_object()
        resp = (request.data.get("response") or "").strip().lower()
        if resp not in {"confirm", "deny", "unsure"}:
            return Response({"detail": "Invalid response."}, status=status.HTTP_400_BAD_REQUEST)

        # simple role-based weight
        role = getattr(getattr(request.user, "profile", None), "role", None)
        if role == UserRole.ADMIN:
            weight = 10.0
        elif role == UserRole.ANALYST:
            weight = 8.0
        elif role == UserRole.TRUSTED_VERIFIER:
            weight = 5.0
        else:
            weight = 1.0

        events = incident.metadata.get("verification_events", [])
        # update or append event for this user
        found = False
        for ev in events:
            if ev.get("user_id") == getattr(request.user, "id", None):
                ev.update({
                    "response": resp,
                    "weight": weight,
                    "role": role,
                    "submitted_at": timezone.now().isoformat(),
                })
                found = True
                break
        if not found:
            events.append({
                "user_id": getattr(request.user, "id", None),
                "username": getattr(request.user, "username", None),
                "response": resp,
                "weight": weight,
                "role": role,
                "submitted_at": timezone.now().isoformat(),
            })

        # compute summary
        confirm_weight = sum(e.get("weight", 0) for e in events if e.get("response") == "confirm")
        deny_weight = sum(e.get("weight", 0) for e in events if e.get("response") == "deny")
        unsure_count = sum(1 for e in events if e.get("response") == "unsure")
        confirm_count = sum(1 for e in events if e.get("response") == "confirm")
        deny_count = sum(1 for e in events if e.get("response") == "deny")
        decisive = confirm_weight + deny_weight
        consensus_ratio = float(confirm_weight / decisive) if decisive > 0 else None

        incident.metadata = {
            **incident.metadata,
            "verification_events": events,
            "verification_summary": {
                "total_votes": len(events),
                "confirm_count": confirm_count,
                "deny_count": deny_count,
                "unsure_count": unsure_count,
                "confirm_weight": confirm_weight,
                "deny_weight": deny_weight,
                "consensus_ratio": consensus_ratio,
            },
        }
        incident.save(update_fields=["metadata", "updated_at"])

        record_audit_event(
            "incident.verification_submitted",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Verification '{resp}' submitted for incident '{incident.title}'.",
        )

        return Response(self.get_serializer(incident).data)
