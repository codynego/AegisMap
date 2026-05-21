from django.db import models


class GeofenceType(models.TextChoices):
    SCHOOL = "school", "School"
    VILLAGE = "village", "Village"
    HIGHWAY = "highway", "Highway"
    PIPELINE = "pipeline", "Pipeline"
    FACILITY = "facility", "Facility"
    CUSTOM = "custom", "Custom"


class GeofenceStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    PAUSED = "paused", "Paused"
    ARCHIVED = "archived", "Archived"


class Geofence(models.Model):
    name = models.CharField(max_length=255)
    geofence_type = models.CharField(
        max_length=16,
        choices=GeofenceType.choices,
        default=GeofenceType.CUSTOM,
    )
    status = models.CharField(
        max_length=16,
        choices=GeofenceStatus.choices,
        default=GeofenceStatus.ACTIVE,
    )
    boundary = models.JSONField(default=dict, blank=True)
    centroid_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    centroid_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    radius_meters = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    notify_on_signal = models.BooleanField(default=True)
    notify_on_incident = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
