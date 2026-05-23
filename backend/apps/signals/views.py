from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import AllowCreateAuthenticatedReadAnalystWrite
from apps.users.permissions import IsAnalystOrAdmin
from apps.users.permissions import can_submit_public_verification, get_user_role, is_analyst_or_admin, is_internal_user, is_trusted_reporter
from apps.users.models import UserRole

from .analytics import build_signal_analytics
from .ingestion import process_ingestion_job
from .models import ConfidenceLevel, Signal, SignalEvidence, SignalIngestionJob, SignalStatus
from .serializers import (
    SignalEvidenceSerializer,
    SignalIngestionJobSerializer,
    SignalSerializer,
    SignalVerificationSerializer,
    SignalVerificationSubmitSerializer,
)
from .services import assess_signal, dispatch_signal_pipeline, submit_signal_verification


class SignalViewSet(viewsets.ModelViewSet):
    serializer_class = SignalSerializer
    permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
    queryset = Signal.objects.select_related(
        "source_profile",
        "submitted_by",
        "cluster",
    ).prefetch_related("evidence_items")

    def get_permissions(self):
        if self.action == "create":
            permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
        elif self.action in {
            "update",
            "partial_update",
            "destroy",
            "reassess",
            "dismiss",
            "verify",
            "reject",
            "escalate",
            "merge_duplicate",
        }:
            permission_classes = [IsAnalystOrAdmin]
        elif self.action == "submit_verification":
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = self.queryset
        category = self.request.query_params.get("category")
        confidence = self.request.query_params.get("confidence")
        status_value = self.request.query_params.get("status")
        verification_queue = self.request.query_params.get("verification_queue") == "true"
        user = self.request.user

        if category:
            queryset = queryset.filter(category=category)
        if confidence:
            queryset = queryset.filter(confidence=confidence)
        if status_value:
            queryset = queryset.filter(status=status_value)

        if is_internal_user(user):
            return queryset

        if self.action == "submit_verification":
            return queryset.exclude(status=SignalStatus.DISMISSED)

        if verification_queue and is_trusted_reporter(user):
            return queryset.filter(
                confidence__in=[
                    ConfidenceLevel.RAW,
                    ConfidenceLevel.LOW,
                    ConfidenceLevel.EMERGING,
                    ConfidenceLevel.DISPUTED,
                ],
            ).exclude(status=SignalStatus.DISMISSED)

        if can_submit_public_verification(user):
            return queryset.filter(
                Q(submitted_by=user)
                | Q(confidence__in=[ConfidenceLevel.CORROBORATED, ConfidenceLevel.HIGH])
            ).exclude(status=SignalStatus.DISMISSED)

        return queryset.none()

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

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        signal = self.get_object()
        signal.status = "triaged"
        signal.confidence = "corroborated" if signal.confidence in {"raw", "low", "emerging"} else signal.confidence
        signal.metadata = {
            **signal.metadata,
            "verified_at": signal.updated_at.isoformat() if signal.updated_at else None,
            "verified_by": request.user.username if request.user.is_authenticated else None,
        }
        signal.save(update_fields=["status", "confidence", "metadata", "updated_at"])
        record_audit_event(
            "signal.verified",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' verified.",
        )
        return Response(self.get_serializer(signal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        signal = self.get_object()
        signal.status = "dismissed"
        signal.metadata = {
            **signal.metadata,
            "rejected_at": signal.updated_at.isoformat() if signal.updated_at else None,
            "rejected_by": request.user.username if request.user.is_authenticated else None,
        }
        signal.save(update_fields=["status", "metadata", "updated_at"])
        record_audit_event(
            "signal.rejected",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' rejected.",
        )
        return Response(self.get_serializer(signal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        signal = self.get_object()
        signal.status = "escalated"
        signal.metadata = {
            **signal.metadata,
            "escalated_at": signal.updated_at.isoformat() if signal.updated_at else None,
            "escalated_by": request.user.username if request.user.is_authenticated else None,
        }
        signal.save(update_fields=["status", "metadata", "updated_at"])
        assess_signal(signal)
        record_audit_event(
            "signal.escalated",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' escalated.",
        )
        return Response(self.get_serializer(signal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def merge_duplicate(self, request, pk=None):
        signal = self.get_object()
        target_signal_id = request.data.get("target_signal_id")
        if not target_signal_id:
            return Response(
                {"detail": "target_signal_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_signal = get_object_or_404(Signal, pk=target_signal_id)
        if target_signal.pk == signal.pk:
            return Response(
                {"detail": "A signal cannot be merged into itself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        signal.status = "dismissed"
        signal.cluster = target_signal.cluster or signal.cluster
        signal.metadata = {
            **signal.metadata,
            "duplicate_of": str(target_signal.pk),
            "merged_at": signal.updated_at.isoformat() if signal.updated_at else None,
            "merged_by": request.user.username if request.user.is_authenticated else None,
        }
        signal.save(update_fields=["status", "cluster", "metadata", "updated_at"])
        record_audit_event(
            "signal.merged_duplicate",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Signal '{signal.title}' merged into '{target_signal.title}'.",
            metadata={"target_signal_id": str(target_signal.pk)},
        )
        return Response(
            {
                "merged_signal": self.get_serializer(signal).data,
                "target_signal": self.get_serializer(target_signal).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def submit_verification(self, request, pk=None):
        signal = self.get_object()
        serializer = SignalVerificationSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = submit_signal_verification(
            signal=signal,
            user=request.user,
            response=serializer.validated_data["response"],
            distance_meters=serializer.validated_data.get("distance_meters"),
            note=serializer.validated_data.get("note", ""),
        )
        signal.refresh_from_db()
        record_audit_event(
            "signal.verification_submitted",
            actor=request.user if request.user.is_authenticated else None,
            obj=signal,
            request=request,
            description=f"Verification submitted for signal '{signal.title}'.",
            metadata={
                "response": verification.response,
                "weight": float(verification.weight),
            },
        )
        return Response(
            {
                "signal": self.get_serializer(signal).data,
                "verification": SignalVerificationSerializer(verification).data,
            },
            status=status.HTTP_200_OK,
        )


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
    permission_classes = [IsAnalystOrAdmin]

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response(build_signal_analytics())
