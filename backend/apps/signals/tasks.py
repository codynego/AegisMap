from celery import shared_task

from .ingestion import process_ingestion_job
from .models import Signal, SignalIngestionJob
from .services import run_signal_pipeline


@shared_task
def run_signal_pipeline_task(signal_id: str) -> None:
    signal = Signal.objects.get(pk=signal_id)
    run_signal_pipeline(signal)


@shared_task
def process_ingestion_job_task(job_id: int) -> None:
    job = SignalIngestionJob.objects.get(pk=job_id)
    process_ingestion_job(job)
