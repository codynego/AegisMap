from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite

from .models import RiskSnapshot, WatchZone
from .serializers import RiskSnapshotSerializer, WatchZoneSerializer
from .services import evaluate_watch_zone


class WatchZoneViewSet(viewsets.ModelViewSet):
    serializer_class = WatchZoneSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = WatchZone.objects.prefetch_related("snapshots")

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        risk_level = self.request.query_params.get("risk_level")

        if status_value:
            queryset = queryset.filter(status=status_value)
        if risk_level:
            queryset = queryset.filter(current_risk_level=risk_level)

        return queryset

    @action(detail=True, methods=["post"])
    def evaluate(self, request, pk=None):
        watch_zone = self.get_object()
        evaluate_watch_zone(watch_zone)
        watch_zone.refresh_from_db()
        record_audit_event(
            "watch_zone.evaluated",
            actor=request.user,
            obj=watch_zone,
            request=request,
            description=f"Watch zone '{watch_zone.name}' evaluated.",
        )
        return Response(self.get_serializer(watch_zone).data)


class RiskSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = RiskSnapshotSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = RiskSnapshot.objects.select_related(
        "watch_zone",
        "pattern",
        "incident",
    )

    def get_queryset(self):
        queryset = self.queryset
        watch_zone_id = self.request.query_params.get("watch_zone")
        if watch_zone_id:
            queryset = queryset.filter(watch_zone_id=watch_zone_id)
        return queryset
