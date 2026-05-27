from django.db import models
from django.contrib.auth import get_user_model


class UserPreference(models.Model):
    user = models.OneToOneField(get_user_model(), on_delete=models.CASCADE, related_name="preferences")
    display_name = models.CharField(max_length=255, blank=True)
    default_dashboard = models.CharField(max_length=128, default="/dashboard")
    time_horizon = models.CharField(max_length=16, default="24h")
    email_alerts = models.BooleanField(default=True)
    show_heatmap = models.BooleanField(default=True)
    # Alert preferences
    flood_alerts = models.BooleanField(default=True)
    route_warnings = models.BooleanField(default=True)
    emergency_alerts = models.BooleanField(default=True)
    minor_incidents = models.BooleanField(default=False)
    severity_threshold = models.CharField(max_length=16, default="medium")
    alert_radius_km = models.IntegerField(default=50)

    # Privacy
    anonymous_reporting = models.BooleanField(default=False)
    blur_exact_location = models.BooleanField(default=True)
    share_profile_public = models.BooleanField(default=False)

    # Notification channels
    push_notifications = models.BooleanField(default=True)
    sms_alerts = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.user}"
