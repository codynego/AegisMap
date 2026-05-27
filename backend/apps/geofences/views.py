from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.risk.models import WatchZone
from apps.users.permissions import AllowCreateAuthenticatedReadAnalystWrite

from .models import Geofence
from .serializers import GeofenceSerializer


class GeofenceViewSet(viewsets.ModelViewSet):
    serializer_class = GeofenceSerializer
    permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
    queryset = Geofence.objects.all()

    def perform_create(self, serializer):
        geofence = serializer.save()
        metadata = geofence.metadata or {}
        is_user_watch_area = metadata.get("created_from") == "live_intelligence_pin" and metadata.get("pin_action") == "watch_zone"

        if is_user_watch_area:
            WatchZone.objects.create(
                name=geofence.name,
                zone_type="watch_area",
                status="active",
                centroid_latitude=geofence.centroid_latitude,
                centroid_longitude=geofence.centroid_longitude,
                boundary=geofence.boundary,
                notes=geofence.description,
                metadata={
                    **metadata,
                    "geofence_id": geofence.id,
                    "source": "geofence",
                },
            )

    def get_queryset(self):
        queryset = self.queryset
        geofence_type = self.request.query_params.get("geofence_type")
        status_value = self.request.query_params.get("status")

        if geofence_type:
            queryset = queryset.filter(geofence_type=geofence_type)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset
