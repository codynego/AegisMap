from rest_framework import serializers

from .models import Signal, SignalEvidence, SignalIngestionJob


class SignalEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SignalEvidence
        fields = [
            "id",
            "signal",
            "media_asset",
            "evidence_type",
            "external_url",
            "caption",
            "captured_at",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SignalSerializer(serializers.ModelSerializer):
    evidence_items = SignalEvidenceSerializer(many=True, read_only=True)
    duplicate_of = serializers.SerializerMethodField()

    class Meta:
        model = Signal
        fields = [
            "id",
            "title",
            "description",
            "source_profile",
            "submitted_by",
            "cluster",
            "category",
            "status",
            "confidence",
            "severity",
            "location_name",
            "latitude",
            "longitude",
            "coordinate_precision_meters",
            "route_hint",
            "occurred_at",
            "received_at",
            "extracted_entities",
            "metadata",
            "created_at",
            "updated_at",
            "evidence_items",
            "duplicate_of",
        ]
        read_only_fields = ["id", "received_at", "created_at", "updated_at"]

    def get_duplicate_of(self, obj):
        return obj.metadata.get("duplicate_of")


class SignalIngestionJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SignalIngestionJob
        fields = [
            "id",
            "source_type",
            "status",
            "submitted_by",
            "name",
            "payload",
            "processed_count",
            "created_signal_ids",
            "error_message",
            "created_at",
            "updated_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "status",
            "processed_count",
            "created_signal_ids",
            "error_message",
            "created_at",
            "updated_at",
            "completed_at",
        ]
