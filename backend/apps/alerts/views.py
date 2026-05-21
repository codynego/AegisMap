from rest_framework import viewsets

from .models import Alert, AlertRule
from .serializers import AlertRuleSerializer, AlertSerializer


class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
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

        return queryset


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer
    queryset = AlertRule.objects.all()
