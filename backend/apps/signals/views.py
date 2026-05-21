from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import AllowCreateAuthenticatedReadAnalystWrite
from apps.users.permissions import IsAnalystOrAdmin

from .analytics import build_signal_analytics
from .ingestion import process_ingestion_job
from .models import Signal, SignalEvidence, SignalIngestionJob
from .serializers import SignalEvidenceSerializer, SignalIngestionJobSerializer, SignalSerializer
from .services import assess_signal, dispatch_signal_pipeline


class SignalViewSet(viewsets.ModelViewSet):
    serializer_class = SignalSerializer
    permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
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

    def perform_create(self, serializer):
        submitted_by = self.request.user if self.request.user.is_authenticated else None
        signal = serializer.save(submitted_by=submitted_by)
        dispatch_signal_pipeline(signal)
        record_audit_event(
            "signal.created",
            actor=submitted_by,
            obj=signal,
            request=self.request,
            description=f"Signal '{signal.title}' submitted.",
        )

    def perform_update(self, serializer):
        signal = serializer.save()
        assess_signal(signal)
        record_audit_event(
            "signal.updated",
            actor=self.request.user if self.request.user.is_authenticated else None,
            obj=signal,
            request=self.request,
            description=f"Signal '{signal.title}' updated.",
        )

    @action(detail=True, methods=["post"])
    def reassess(self, request, pk=None):
        signal = self.get_object()
        assess_signal(signal)
        record_audit_event(
            "signal.reassessed",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' reassessed.",
        )
        return Response(self.get_serializer(signal).data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        signal = self.get_object()
        signal.status = "dismissed"
        signal.metadata = {**signal.metadata, "dismissed_at": signal.updated_at.isoformat() if signal.updated_at else None}
        signal.save(update_fields=["status", "metadata", "updated_at"])
        record_audit_event(
            "signal.dismissed",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' dismissed.",
        )
        return Response(self.get_serializer(signal).data, status=status.HTTP_200_OK)


class SignalEvidenceViewSet(viewsets.ModelViewSet):
    serializer_class = SignalEvidenceSerializer
    permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
    queryset = SignalEvidence.objects.select_related("signal", "media_asset")

    def get_queryset(self):
        queryset = self.queryset
        signal_id = self.request.query_params.get("signal")
        if signal_id:
            queryset = queryset.filter(signal_id=signal_id)
        return queryset


class SignalIngestionJobViewSet(viewsets.ModelViewSet):
    serializer_class = SignalIngestionJobSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = SignalIngestionJob.objects.select_related("submitted_by")

    def perform_create(self, serializer):
        job = serializer.save(submitted_by=self.request.user)
        if self.request.query_params.get("async") == "true":
            from .tasks import process_ingestion_job_task

            process_ingestion_job_task.delay(job.pk)
        else:
            process_ingestion_job(job)
        record_audit_event(
            "ingestion.job.created",
            actor=self.request.user,
            obj=job,
            request=self.request,
            description=f"Ingestion job '{job.name}' created.",
        )


class SignalAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response(build_signal_analytics())
