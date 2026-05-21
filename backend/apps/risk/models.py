from django.db import models


class RiskLevel(models.TextChoices):
    BASELINE = "baseline", "Baseline"
    ELEVATED = "elevated_watch", "Elevated Watch"
    MEDIUM = "medium_risk", "Medium Risk"
    HIGH = "high_risk", "High Risk"
    CRITICAL = "critical_alert", "Critical Alert"


class WatchZoneStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    MONITORING = "monitoring", "Monitoring"
    PAUSED = "paused", "Paused"
    ARCHIVED = "archived", "Archived"


class WatchZone(models.Model):
    name = models.CharField(max_length=255)
    zone_type = models.CharField(max_length=64, default="custom")
    status = models.CharField(
        max_length=16,
        choices=WatchZoneStatus.choices,
        default=WatchZoneStatus.ACTIVE,
    )
    current_risk_level = models.CharField(
        max_length=16,
        choices=RiskLevel.choices,
        default=RiskLevel.BASELINE,
    )
    current_risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    centroid_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    centroid_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    boundary = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    last_evaluated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RiskSnapshot(models.Model):
    watch_zone = models.ForeignKey(
        WatchZone,
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    pattern = models.ForeignKey(
        "incidents.Pattern",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="risk_snapshots",
    )
    incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="risk_snapshots",
    )
    risk_level = models.CharField(
        max_length=16,
        choices=RiskLevel.choices,
        default=RiskLevel.BASELINE,
    )
    risk_score = models.DecimalField(max_digits=5, decimal_places=2)
    rationale = models.TextField(blank=True)
    factors = models.JSONField(default=dict, blank=True)
    snapshot_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-snapshot_at"]

    def __str__(self) -> str:
        return f"{self.watch_zone.name} @ {self.snapshot_at:%Y-%m-%d %H:%M}"
