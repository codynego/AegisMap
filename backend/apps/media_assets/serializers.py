from rest_framework import serializers

from .models import MediaAsset, PatrolUpload


class PatrolUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatrolUpload
        fields = [
            "id",
            "title",
            "uploaded_by",
            "source_profile",
            "upload_source",
            "summary",
            "recorded_at",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at", "updated_at"]


class MediaAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "uploaded_by",
            "source_profile",
            "patrol_upload",
            "media_type",
            "file",
            "external_url",
            "original_filename",
            "mime_type",
            "file_size_bytes",
            "sha256_hash",
            "captured_at",
            "latitude",
            "longitude",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "created_at"]
