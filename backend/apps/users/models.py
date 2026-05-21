from django.conf import settings
from django.db import models


class UserRole(models.TextChoices):
    COMMUNITY_REPORTER = "community_reporter", "Community Reporter"
    TRUSTED_VERIFIER = "trusted_verifier", "Trusted Verifier"
    ANALYST = "analyst", "Analyst"
    ADMIN = "admin", "Admin"


class ReliabilityBand(models.TextChoices):
    LOW = "low", "Low"
    MODERATE = "moderate", "Moderate"
    HIGH = "high", "High"
    TRUSTED = "trusted", "Trusted"


class SourceType(models.TextChoices):
    USER = "user", "User"
    ANONYMOUS = "anonymous", "Anonymous"
    NGO = "ngo", "NGO"
    JOURNALIST = "journalist", "Journalist"
    TRANSPORT = "transport", "Transport Network"
    CIVIC_MONITOR = "civic_monitor", "Civic Monitor"
    PATROL = "patrol", "Patrol"
    DRONE = "drone", "Drone"
    SOCIAL = "social", "Social Feed"
    PUBLIC_DATA = "public_data", "Public Dataset"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.COMMUNITY_REPORTER,
    )
    organization = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    region_name = models.CharField(max_length=255, blank=True)
    is_active_operator = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self) -> str:
        return self.display_name or self.user.get_username()


class SourceProfile(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_profiles",
    )
    label = models.CharField(max_length=255)
    source_type = models.CharField(
        max_length=32,
        choices=SourceType.choices,
        default=SourceType.USER,
    )
    reliability_band = models.CharField(
        max_length=16,
        choices=ReliabilityBand.choices,
        default=ReliabilityBand.MODERATE,
    )
    trust_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.50)
    report_count = models.PositiveIntegerField(default=0)
    verified_signal_count = models.PositiveIntegerField(default=0)
    disputed_signal_count = models.PositiveIntegerField(default=0)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["label"]

    def __str__(self) -> str:
        return self.label
