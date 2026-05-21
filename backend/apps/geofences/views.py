from rest_framework import viewsets

from apps.users.permissions import IsAuthenticatedReadAnalystWrite

from .models import Geofence
from .serializers import GeofenceSerializer


class GeofenceViewSet(viewsets.ModelViewSet):
    serializer_class = GeofenceSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Geofence.objects.all()

    def get_queryset(self):
        queryset = self.queryset
        geofence_type = self.request.query_params.get("geofence_type")
        status_value = self.request.query_params.get("status")

        if geofence_type:
            queryset = queryset.filter(geofence_type=geofence_type)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset
