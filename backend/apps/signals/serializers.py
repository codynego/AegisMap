from rest_framework import serializers

from apps.users.permissions import is_analyst_or_admin

from .models import Signal, SignalEvidence, SignalIngestionJob, SignalVerification, VerificationResponse


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
    confidence_score = serializers.SerializerMethodField()
    verification_summary = serializers.SerializerMethodField()

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
            "confidence_score",
            "verification_summary",
        ]
        read_only_fields = ["id", "received_at", "created_at", "updated_at"]

    def get_duplicate_of(self, obj):
        return obj.metadata.get("duplicate_of")

    def get_confidence_score(self, obj):
        score = obj.metadata.get("confidence_score")
        return round(score * 100, 2) if isinstance(score, (int, float)) else None

    def get_verification_summary(self, obj):
        return obj.metadata.get("verification_summary", {})

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if is_analyst_or_admin(user):
            return data

        allowed_fields = {
            "id",
            "title",
            "description",
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
            "created_at",
            "updated_at",
            "verification_summary",
        }
        return {key: value for key, value in data.items() if key in allowed_fields}


class SignalVerificationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = SignalVerification
        fields = [
            "id",
            "signal",
            "user",
            "username",
            "source_profile",
            "response",
            "weight",
            "distance_meters",
            "note",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "signal",
            "user",
            "username",
            "source_profile",
            "weight",
            "metadata",
            "created_at",
            "updated_at",
        ]


class SignalVerificationSubmitSerializer(serializers.Serializer):
    response = serializers.ChoiceField(choices=VerificationResponse.choices)
    distance_meters = serializers.IntegerField(required=False, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


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
