from django.conf import settings
from django.db import models


class MediaType(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"
    AUDIO = "audio", "Audio"
    DOCUMENT = "document", "Document"
    THERMAL = "thermal", "Thermal"
    OTHER = "other", "Other"


class UploadSource(models.TextChoices):
    REPORT = "report", "Report"
    PATROL = "patrol", "Patrol"
    DRONE = "drone", "Drone"
    IMPORT = "import", "Import"


class PatrolUpload(models.Model):
    title = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="patrol_uploads",
    )
    source_profile = models.ForeignKey(
        "users.SourceProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="patrol_uploads",
    )
    upload_source = models.CharField(
        max_length=16,
        choices=UploadSource.choices,
        default=UploadSource.PATROL,
    )
    summary = models.TextField(blank=True)
    recorded_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class MediaAsset(models.Model):
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_assets",
    )
    source_profile = models.ForeignKey(
        "users.SourceProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_assets",
    )
    patrol_upload = models.ForeignKey(
        PatrolUpload,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_assets",
    )
    media_type = models.CharField(
        max_length=16,
        choices=MediaType.choices,
        default=MediaType.IMAGE,
    )
    file = models.FileField(upload_to="uploads/%Y/%m/%d/", blank=True)
    external_url = models.URLField(blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=127, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    sha256_hash = models.CharField(max_length=64, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.original_filename or f"Media asset {self.pk}"
