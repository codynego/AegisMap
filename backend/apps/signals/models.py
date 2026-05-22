import uuid

from django.conf import settings
from django.db import models


class SignalCategory(models.TextChoices):
    SUSPICIOUS_ACTIVITY = "suspicious_activity", "Suspicious Activity"
    ROAD_ACCIDENT = "road_accident", "Road Accident"
    KIDNAPPING = "kidnapping", "Kidnapping"
    ARMED_ROBBERY = "armed_robbery", "Armed Robbery"
    FIRE_OUTBREAK = "fire_outbreak", "Fire Outbreak"
    ROAD_OBSTRUCTION = "road_obstruction", "Road Obstruction"
    FLOODING = "flooding", "Flooding"
    MEDICAL_EMERGENCY = "medical_emergency", "Medical Emergency"
    GUNSHOTS_HEARD = "gunshots_heard", "Gunshots Heard"
    UNSAFE_ROUTE = "unsafe_route", "Unsafe Route"


class SignalStatus(models.TextChoices):
    RAW = "raw", "Raw"
    TRIAGED = "triaged", "Triaged"
    CLUSTERED = "clustered", "Clustered"
    ESCALATED = "escalated", "Escalated"
    DISMISSED = "dismissed", "Dismissed"


class ConfidenceLevel(models.TextChoices):
    RAW = "raw", "Raw"
    LOW = "low", "Low Confidence"
    EMERGING = "emerging", "Emerging"
    CORROBORATED = "corroborated", "Corroborated"
    HIGH = "high", "High Confidence"
    DISPUTED = "disputed", "Disputed"


class SeverityLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class Signal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    source_profile = models.ForeignKey(
        "users.SourceProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signals",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_signals",
    )
    cluster = models.ForeignKey(
        "incidents.SignalCluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signals",
    )
    category = models.CharField(
        max_length=32,
        choices=SignalCategory.choices,
        default=SignalCategory.SUSPICIOUS_ACTIVITY,
    )
    status = models.CharField(
        max_length=16,
        choices=SignalStatus.choices,
        default=SignalStatus.RAW,
    )
    confidence = models.CharField(
        max_length=16,
        choices=ConfidenceLevel.choices,
        default=ConfidenceLevel.RAW,
    )
    severity = models.CharField(
        max_length=16,
        choices=SeverityLevel.choices,
        default=SeverityLevel.LOW,
    )
    location_name = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    coordinate_precision_meters = models.PositiveIntegerField(null=True, blank=True)
    route_hint = models.CharField(max_length=255, blank=True)
    occurred_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    extracted_entities = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self) -> str:
        return self.title


class SignalEvidenceType(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"
    AUDIO = "audio", "Audio"
    DOCUMENT = "document", "Document"
    LINK = "link", "Link"
    NOTE = "note", "Note"


class SignalEvidence(models.Model):
    signal = models.ForeignKey(
        Signal,
        on_delete=models.CASCADE,
        related_name="evidence_items",
    )
    media_asset = models.ForeignKey(
        "media_assets.MediaAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signal_evidence",
    )
    evidence_type = models.CharField(
        max_length=16,
        choices=SignalEvidenceType.choices,
        default=SignalEvidenceType.NOTE,
    )
    external_url = models.URLField(blank=True)
    caption = models.CharField(max_length=255, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["signal", "-created_at"]

    def __str__(self) -> str:
        return f"{self.signal.title} - {self.evidence_type}"


class IngestionSourceType(models.TextChoices):
    API = "api", "API"
    CSV = "csv", "CSV"
    SOCIAL = "social", "Social"
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"
    BULK = "bulk", "Bulk"


class IngestionJobStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class SignalIngestionJob(models.Model):
    source_type = models.CharField(
        max_length=16,
        choices=IngestionSourceType.choices,
        default=IngestionSourceType.API,
    )
    status = models.CharField(
        max_length=16,
        choices=IngestionJobStatus.choices,
        default=IngestionJobStatus.PENDING,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ingestion_jobs",
    )
    name = models.CharField(max_length=255)
    payload = models.JSONField(default=dict, blank=True)
    processed_count = models.PositiveIntegerField(default=0)
    created_signal_ids = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
