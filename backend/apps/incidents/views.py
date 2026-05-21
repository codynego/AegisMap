from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite

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
