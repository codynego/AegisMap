from rest_framework import serializers

from .models import RiskSnapshot, WatchZone


class RiskSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskSnapshot
        fields = [
            "id",
            "watch_zone",
            "pattern",
            "incident",
            "risk_level",
            "risk_score",
            "rationale",
            "factors",
            "snapshot_at",
        ]
        read_only_fields = ["id", "snapshot_at"]


class WatchZoneSerializer(serializers.ModelSerializer):
    snapshots = RiskSnapshotSerializer(many=True, read_only=True)

    class Meta:
        model = WatchZone
        fields = [
            "id",
            "name",
            "zone_type",
            "status",
            "current_risk_level",
            "current_risk_score",
            "centroid_latitude",
            "centroid_longitude",
            "boundary",
            "notes",
            "metadata",
            "last_evaluated_at",
            "created_at",
            "updated_at",
            "snapshots",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RiskForecastSerializer(serializers.Serializer):
    id = serializers.CharField()
    cluster_name = serializers.CharField()
    category = serializers.CharField()
    level = serializers.CharField()
    probability = serializers.IntegerField()
    confidence = serializers.IntegerField()
    window = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    summary = serializers.CharField()
    rationale = serializers.ListField(child=serializers.CharField())
    timing_note = serializers.CharField()
    source_count = serializers.IntegerField()
    recent_count = serializers.IntegerField()
    previous_count = serializers.IntegerField()
    active_reports = serializers.IntegerField()
    high_severity_count = serializers.IntegerField()
    night_share = serializers.FloatField()
    route_signal = serializers.FloatField()
    anomaly_signal = serializers.FloatField()
