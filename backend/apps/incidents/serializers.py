from rest_framework import serializers

from .models import Incident, Pattern, SignalCluster


class SignalClusterSerializer(serializers.ModelSerializer):
    signal_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = SignalCluster
        fields = [
            "id",
            "name",
            "cluster_type",
            "confidence",
            "status",
            "centroid_latitude",
            "centroid_longitude",
            "radius_meters",
            "started_at",
            "last_seen_at",
            "summary",
            "metadata",
            "created_at",
            "updated_at",
            "signal_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "signal_count"]


class PatternSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pattern
        fields = [
            "id",
            "name",
            "cluster",
            "confidence",
            "severity",
            "status",
            "geographic_hint",
            "centroid_latitude",
            "centroid_longitude",
            "first_detected_at",
            "last_detected_at",
            "summary",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            "id",
            "title",
            "incident_type",
            "pattern",
            "primary_signal",
            "confidence",
            "severity",
            "status",
            "location_name",
            "latitude",
            "longitude",
            "detected_at",
            "started_at",
            "resolved_at",
            "summary",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "detected_at", "created_at", "updated_at"]
