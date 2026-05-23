from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite, IsAnalystOrAdmin
from apps.users.permissions import is_analyst_or_admin

from .models import Alert, AlertRule
from .serializers import AlertRuleSerializer, AlertSerializer


class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Alert.objects.select_related(
        "rule",
        "watch_zone",
        "geofence",
        "cluster",
        "pattern",
        "incident",
    )

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")

        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)

        if not is_analyst_or_admin(self.request.user):
            queryset = queryset.exclude(status="dismissed")

        return queryset

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.status = "acknowledged"
        alert.acknowledged_at = timezone.now()
        alert.save(update_fields=["status", "acknowledged_at"])
        record_audit_event(
            "alert.acknowledged",
            actor=request.user,
            obj=alert,
            request=request,
            description=f"Alert '{alert.title}' acknowledged.",
        )
        return Response(self.get_serializer(alert).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.status = "resolved"
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["status", "resolved_at"])
        record_audit_event(
            "alert.resolved",
            actor=request.user,
            obj=alert,
            request=request,
            description=f"Alert '{alert.title}' resolved.",
        )
        return Response(self.get_serializer(alert).data)


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = AlertRule.objects.all()
