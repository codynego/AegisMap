from rest_framework import serializers

from .models import UserPreference


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = [
            "id",
            "display_name",
            "default_dashboard",
            "time_horizon",
            "email_alerts",
            "show_heatmap",
            # alerts
            "flood_alerts",
            "route_warnings",
            "emergency_alerts",
            "minor_incidents",
            "severity_threshold",
            "alert_radius_km",
            # privacy
            "anonymous_reporting",
            "blur_exact_location",
            "share_profile_public",
            # notifications
            "push_notifications",
            "sms_alerts",
            "created_at",
            "updated_at",
        ]
