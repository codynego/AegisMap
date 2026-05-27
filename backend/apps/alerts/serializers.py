from rest_framework import serializers

from apps.users.permissions import is_analyst_or_admin

from .models import Alert, AlertRule
from apps.incidents.serializers import IncidentSerializer


def _metadata_value(instance, key, fallback=None):
    if isinstance(getattr(instance, "metadata", None), dict):
        value = instance.metadata.get(key)
        if value not in {None, ""}:
            return value
    return fallback


class AlertRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "min_confidence",
            "min_severity",
            "threshold_count",
            "radius_meters",
            "window_minutes",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AlertSerializer(serializers.ModelSerializer):
    location_name = serializers.SerializerMethodField()
    location_state = serializers.SerializerMethodField()
    location_latitude = serializers.SerializerMethodField()
    location_longitude = serializers.SerializerMethodField()
    incident_preview = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = [
            "id",
            "rule",
            "watch_zone",
            "geofence",
            "cluster",
            "pattern",
            "incident",
            "severity",
            "status",
            "title",
            "message",
            "metadata",
            "location_name",
            "location_state",
            "location_latitude",
            "location_longitude",
            "triggered_at",
            "acknowledged_at",
            "resolved_at",
            "incident_preview",
        ]
        read_only_fields = ["id", "triggered_at"]

    def get_location_name(self, instance):
        return _metadata_value(
            instance,
            "location_name",
            getattr(instance.watch_zone, "name", None)
            or getattr(instance.geofence, "name", None)
            or getattr(instance.incident, "location_name", None)
            or getattr(instance.cluster, "name", None),
        )

    def get_location_state(self, instance):
        return _metadata_value(instance, "location_state", "")

    def get_location_latitude(self, instance):
        return _metadata_value(
            instance,
            "location_latitude",
            getattr(instance.watch_zone, "centroid_latitude", None)
            or getattr(instance.geofence, "centroid_latitude", None)
            or getattr(instance.incident, "latitude", None),
        )

    def get_location_longitude(self, instance):
        return _metadata_value(
            instance,
            "location_longitude",
            getattr(instance.watch_zone, "centroid_longitude", None)
            or getattr(instance.geofence, "centroid_longitude", None)
            or getattr(instance.incident, "longitude", None),
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if is_analyst_or_admin(user):
            return data

        if data.get("location_latitude") is not None:
            data["location_latitude"] = round(float(data["location_latitude"]), 2)
        if data.get("location_longitude") is not None:
            data["location_longitude"] = round(float(data["location_longitude"]), 2)
        data.pop("metadata", None)

        allowed_fields = {
            "id",
            "severity",
            "status",
            "title",
            "message",
            "location_name",
            "location_state",
            "location_latitude",
            "location_longitude",
            "triggered_at",
            "acknowledged_at",
            "resolved_at",
            "incident_preview",
        }
        return {key: value for key, value in data.items() if key in allowed_fields}

    def get_incident_preview(self, instance):
        incident = getattr(instance, "incident", None)
        if incident is None:
            return None
        # Use IncidentSerializer which already exposes `confidence_tier` and redacts metadata for non-analysts
        return IncidentSerializer(incident, context=self.context).data
