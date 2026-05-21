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
