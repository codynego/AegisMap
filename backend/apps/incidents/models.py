from django.db import models

from apps.signals.models import ConfidenceLevel, SeverityLevel


class ClusterType(models.TextChoices):
    PROXIMITY = "proximity", "Spatial Proximity"
    ROUTE = "route", "Route Pattern"
    MOVEMENT = "movement", "Movement Pattern"
    ENVIRONMENTAL = "environmental", "Environmental Pattern"
    MIXED = "mixed", "Mixed"


class PatternStatus(models.TextChoices):
    EMERGING = "emerging", "Emerging"
    MONITORING = "monitoring", "Monitoring"
    ESCALATED = "escalated", "Escalated"
    RESOLVED = "resolved", "Resolved"
    DISMISSED = "dismissed", "Dismissed"


class IncidentStatus(models.TextChoices):
    UNCONFIRMED = "unconfirmed", "Unconfirmed"
    PROBABLE = "probable", "Probable"
    VERIFIED = "verified", "Verified"
    ACTIVE = "active", "Active"
    RESOLVED = "resolved", "Resolved"
    ARCHIVED = "archived", "Archived"


class SignalCluster(models.Model):
    name = models.CharField(max_length=255)
    cluster_type = models.CharField(
        max_length=16,
        choices=ClusterType.choices,
        default=ClusterType.PROXIMITY,
    )
    confidence = models.CharField(
        max_length=16,
        choices=ConfidenceLevel.choices,
        default=ConfidenceLevel.LOW,
    )
    status = models.CharField(
        max_length=16,
        choices=PatternStatus.choices,
        default=PatternStatus.EMERGING,
    )
    centroid_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    centroid_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    radius_meters = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name


class Pattern(models.Model):
    name = models.CharField(max_length=255)
    cluster = models.ForeignKey(
        SignalCluster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="patterns",
    )
    confidence = models.CharField(
        max_length=16,
        choices=ConfidenceLevel.choices,
        default=ConfidenceLevel.EMERGING,
    )
    severity = models.CharField(
        max_length=16,
        choices=SeverityLevel.choices,
        default=SeverityLevel.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=PatternStatus.choices,
        default=PatternStatus.EMERGING,
    )
    geographic_hint = models.CharField(max_length=255, blank=True)
    centroid_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    centroid_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    first_detected_at = models.DateTimeField(null=True, blank=True)
    last_detected_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name


class IncidentType(models.TextChoices):
    SUSPICIOUS_ACTIVITY = "suspicious_activity", "Suspicious Activity"
    ROAD_ACCIDENT = "road_accident", "Road Accident"
    ARMED_ROBBERY = "armed_robbery", "Armed Robbery"
    KIDNAPPING = "kidnapping", "Kidnapping"
    FIRE_OUTBREAK = "fire_outbreak", "Fire Outbreak"
    ROAD_OBSTRUCTION = "road_obstruction", "Road Obstruction"
    FLOODING = "flooding", "Flooding"
    MEDICAL_EMERGENCY = "medical_emergency", "Medical Emergency"
    GUNSHOTS_HEARD = "gunshots_heard", "Gunshots Heard"
    UNSAFE_ROUTE = "unsafe_route", "Unsafe Route"


class Incident(models.Model):
    title = models.CharField(max_length=255)
    incident_type = models.CharField(
        max_length=32,
        choices=IncidentType.choices,
        default=IncidentType.SUSPICIOUS_ACTIVITY,
    )
    pattern = models.ForeignKey(
        Pattern,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )
    primary_signal = models.ForeignKey(
        "signals.Signal",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promoted_incidents",
    )
    confidence = models.CharField(
        max_length=16,
        choices=ConfidenceLevel.choices,
        default=ConfidenceLevel.CORROBORATED,
    )
    severity = models.CharField(
        max_length=16,
        choices=SeverityLevel.choices,
        default=SeverityLevel.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=IncidentStatus.choices,
        default=IncidentStatus.UNCONFIRMED,
    )
    location_name = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    detected_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    summary = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-detected_at"]

    def __str__(self) -> str:
        return self.title
