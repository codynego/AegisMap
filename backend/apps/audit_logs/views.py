from rest_framework import viewsets

from apps.users.permissions import IsAnalystOrAdmin

from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = AuditEvent.objects.select_related("actor")

    def get_queryset(self):
        queryset = self.queryset
        event_type = self.request.query_params.get("event_type")
        severity = self.request.query_params.get("severity")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        if severity:
            queryset = queryset.filter(severity=severity)
        return queryset
