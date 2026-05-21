from rest_framework import viewsets

from .models import RiskSnapshot, WatchZone
from .serializers import RiskSnapshotSerializer, WatchZoneSerializer


class WatchZoneViewSet(viewsets.ModelViewSet):
    serializer_class = WatchZoneSerializer
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


class RiskSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = RiskSnapshotSerializer
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
