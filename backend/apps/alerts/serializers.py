from rest_framework import serializers

from .models import Alert, AlertRule


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
            "triggered_at",
            "acknowledged_at",
            "resolved_at",
        ]
        read_only_fields = ["id", "triggered_at"]
