from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import SourceProfile, UserProfile, UserRole

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user",
            "username",
            "email",
            "display_name",
            "role",
            "organization",
            "phone_number",
            "region_name",
            "is_active_operator",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "username", "email", "created_at", "updated_at"]


class SourceProfileSerializer(serializers.ModelSerializer):
    linked_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = SourceProfile
        fields = [
            "id",
            "user",
            "linked_username",
            "label",
            "source_type",
            "reliability_band",
            "trust_score",
            "report_count",
            "verified_signal_count",
            "disputed_signal_count",
            "last_seen_at",
            "notes",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "linked_username",
            "trust_score",
            "report_count",
            "verified_signal_count",
            "disputed_signal_count",
            "last_seen_at",
            "created_at",
            "updated_at",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "profile"]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=UserRole.choices,
        required=False,
        default=UserRole.COMMUNITY_REPORTER,
    )
    organization = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    region_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "organization",
            "phone_number",
            "region_name",
        ]

    def create(self, validated_data):
        profile_fields = {
            "display_name": validated_data.pop("display_name", ""),
            "role": UserRole.COMMUNITY_REPORTER,
            "organization": validated_data.pop("organization", ""),
            "phone_number": validated_data.pop("phone_number", ""),
            "region_name": validated_data.pop("region_name", ""),
        }
        validated_data.pop("role", None)
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        UserProfile.objects.create(user=user, **profile_fields)
        SourceProfile.objects.create(user=user, label=user.username)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
