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


class WeatherPointInputSerializer(serializers.Serializer):
    id = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    label = serializers.CharField(required=False, allow_blank=True)
    kind = serializers.CharField(required=False, allow_blank=True)
    incident_type = serializers.CharField(required=False, allow_blank=True)
    severity = serializers.CharField(required=False, allow_blank=True)
    summary = serializers.CharField(required=False, allow_blank=True)
    location_name = serializers.CharField(required=False, allow_blank=True)


class WeatherRiskZoneInputSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    risk_level = serializers.CharField()
    risk_score = serializers.FloatField()


class WeatherIntelligenceRequestSerializer(serializers.Serializer):
    points = WeatherPointInputSerializer(many=True, required=False)
    watch_zones = WeatherRiskZoneInputSerializer(many=True, required=False)
    route_path = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2),
        required=False,
    )
