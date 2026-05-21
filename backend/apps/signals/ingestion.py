from django.utils import timezone

from apps.audit_logs.services import record_audit_event

from .models import IngestionJobStatus, Signal, SignalIngestionJob
from .services import run_signal_pipeline


def create_ingestion_job(*, submitted_by, source_type: str, name: str, payload: dict) -> SignalIngestionJob:
    return SignalIngestionJob.objects.create(
        submitted_by=submitted_by,
        source_type=source_type,
        name=name,
        payload=payload,
    )


def process_ingestion_job(job: SignalIngestionJob) -> SignalIngestionJob:
    job.status = IngestionJobStatus.PROCESSING
    job.save(update_fields=["status", "updated_at"])

    created_signals = []
    try:
        for item in job.payload.get("signals", []):
            signal = Signal.objects.create(
                title=item["title"],
                description=item.get("description", ""),
                source_profile_id=item.get("source_profile"),
                category=item.get("category", "tip"),
                severity=item.get("severity", "low"),
                location_name=item.get("location_name", ""),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
                route_hint=item.get("route_hint", ""),
                occurred_at=item.get("occurred_at"),
                extracted_entities=item.get("extracted_entities", []),
                metadata=item.get("metadata", {}),
            )
            run_signal_pipeline(signal)
            created_signals.append(str(signal.pk))

        job.status = IngestionJobStatus.COMPLETED
        job.processed_count = len(created_signals)
        job.created_signal_ids = created_signals
        job.completed_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "processed_count",
                "created_signal_ids",
                "completed_at",
                "updated_at",
            ]
        )
        record_audit_event(
            "ingestion.job.completed",
            actor=job.submitted_by,
            obj=job,
            description=f"Processed ingestion job '{job.name}'.",
            metadata={"processed_count": len(created_signals)},
        )
    except Exception as exc:
        job.status = IngestionJobStatus.FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message", "updated_at"])
        record_audit_event(
            "ingestion.job.failed",
            actor=job.submitted_by,
            severity="error",
            obj=job,
            description=f"Ingestion job '{job.name}' failed.",
            metadata={"error": str(exc)},
        )
        raise

    return job
