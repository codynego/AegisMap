from rest_framework import viewsets

from .models import Signal, SignalEvidence
from .serializers import SignalEvidenceSerializer, SignalSerializer


class SignalViewSet(viewsets.ModelViewSet):
    serializer_class = SignalSerializer
    queryset = Signal.objects.select_related(
        "source_profile",
        "submitted_by",
        "cluster",
    ).prefetch_related("evidence_items")

    def get_queryset(self):
        queryset = self.queryset
        category = self.request.query_params.get("category")
        confidence = self.request.query_params.get("confidence")
        status_value = self.request.query_params.get("status")

        if category:
            queryset = queryset.filter(category=category)
        if confidence:
            queryset = queryset.filter(confidence=confidence)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class SignalEvidenceViewSet(viewsets.ModelViewSet):
    serializer_class = SignalEvidenceSerializer
    queryset = SignalEvidence.objects.select_related("signal", "media_asset")

    def get_queryset(self):
        queryset = self.queryset
        signal_id = self.request.query_params.get("signal")
        if signal_id:
            queryset = queryset.filter(signal_id=signal_id)
        return queryset
