from rest_framework import serializers

from .models import FeatureRequest, FeatureVote


class FeatureRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeatureRequest
        fields = ["id", "feature_id", "title", "description", "votes", "created_at", "updated_at"]


class FeatureVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeatureVote
        fields = ["id", "feature", "user", "created_at"]
        read_only_fields = ["id", "created_at"]
