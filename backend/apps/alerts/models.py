from django.db import models

from apps.signals.models import ConfidenceLevel, SeverityLevel


class AlertRule(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    min_confidence = models.CharField(
        max_length=16,
        choices=ConfidenceLevel.choices,
        default=ConfidenceLevel.EMERGING,
    )
    min_severity = models.CharField(
        max_length=16,
        choices=SeverityLevel.choices,
        default=SeverityLevel.MEDIUM,
    )
    threshold_count = models.PositiveIntegerField(default=1)
    radius_meters = models.PositiveIntegerField(default=5000)
    window_minutes = models.PositiveIntegerField(default=120)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class AlertStatus(models.TextChoices):
    OPEN = "open", "Open"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    DISMISSED = "dismissed", "Dismissed"
    SUPPRESSED = "suppressed", "Suppressed"
    RESOLVED = "resolved", "Resolved"


class Alert(models.Model):
    rule = models.ForeignKey(
        AlertRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    watch_zone = models.ForeignKey(
        "risk.WatchZone",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    geofence = models.ForeignKey(
        "geofences.Geofence",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    cluster = models.ForeignKey(
        "incidents.SignalCluster",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    pattern = models.ForeignKey(
        "incidents.Pattern",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    severity = models.CharField(
        max_length=16,
        choices=SeverityLevel.choices,
        default=SeverityLevel.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=AlertStatus.choices,
        default=AlertStatus.OPEN,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    triggered_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-triggered_at"]

    def __str__(self) -> str:
        return self.title
