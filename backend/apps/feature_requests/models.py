from django.db import models
from django.contrib.auth import get_user_model


class FeatureRequest(models.Model):
    feature_id = models.CharField(max_length=128, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    votes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.feature_id})"


class FeatureVote(models.Model):
    feature = models.ForeignKey(FeatureRequest, related_name="votes_set", on_delete=models.CASCADE)
    user = models.ForeignKey(get_user_model(), null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Vote for {self.feature.feature_id} by {self.user or 'anonymous'}"
