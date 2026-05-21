from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "actor",
            "actor_username",
            "event_type",
            "severity",
            "object_type",
            "object_id",
            "request_path",
            "ip_address",
            "description",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
