from rest_framework import serializers

from apps.users.permissions import is_analyst_or_admin

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
    visibility_score = serializers.SerializerMethodField()
    hidden_from_map = serializers.SerializerMethodField()
    signal_count = serializers.SerializerMethodField()
    confidence_score = serializers.SerializerMethodField()
    confidence_tier = serializers.SerializerMethodField()
    verification_summary = serializers.SerializerMethodField()

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
            "signal_count",
            "confidence_score",
            "confidence_tier",
            "verification_summary",
            "visibility_score",
            "hidden_from_map",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "detected_at", "created_at", "updated_at"]

    def get_visibility_score(self, instance):
        from .services import calculate_incident_visibility_score

        return calculate_incident_visibility_score(instance)

    def get_hidden_from_map(self, instance):
        return bool((instance.metadata or {}).get("hidden_from_map"))

    def get_signal_count(self, instance):
        metadata = instance.metadata or {}
        try:
            return int(metadata.get("signal_count", 1) or 1)
        except (TypeError, ValueError):
            return 1

    def get_confidence_score(self, instance):
        metadata = instance.metadata or {}
        score = metadata.get("confidence_score")
        if isinstance(score, (int, float)):
            return round(float(score) * 100, 2)

        primary_signal = getattr(instance, "primary_signal", None)
        if primary_signal is not None:
            signal_score = (primary_signal.metadata or {}).get("confidence_score")
            if isinstance(signal_score, (int, float)):
                return round(float(signal_score) * 100, 2)
        return None

    def get_confidence_tier(self, instance):
        try:
            score = self.get_visibility_score(instance)
        except Exception:
            score = None

        try:
            if isinstance(score, (int, float)):
                if score >= 0.8:
                    return "verified"
                if score >= 0.6:
                    return "probable"
                if score >= 0.3:
                    return "emerging"
        except Exception:
            pass
        return "raw"

    def get_verification_summary(self, instance):
        metadata = instance.metadata or {}
        summary = metadata.get("verification_summary")
        if isinstance(summary, dict):
            return summary

        primary_signal = getattr(instance, "primary_signal", None)
        signal_summary = (getattr(primary_signal, "metadata", None) or {}).get("verification_summary")
        return signal_summary if isinstance(signal_summary, dict) else {}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if is_analyst_or_admin(user):
            return data

        if data.get("latitude") is not None:
            data["latitude"] = round(float(data["latitude"]), 2)
        if data.get("longitude") is not None:
            data["longitude"] = round(float(data["longitude"]), 2)
        data["location_name"] = data.get("location_name") or "Area withheld"
        data.pop("metadata", None)
        data.pop("primary_signal", None)
        return data
