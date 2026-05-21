from rest_framework import serializers

from .models import Geofence


class GeofenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Geofence
        fields = [
            "id",
            "name",
            "geofence_type",
            "status",
            "boundary",
            "centroid_latitude",
            "centroid_longitude",
            "radius_meters",
            "description",
            "notify_on_signal",
            "notify_on_incident",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
