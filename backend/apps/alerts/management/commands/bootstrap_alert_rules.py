from django.core.management.base import BaseCommand

from apps.alerts.models import AlertRule
from apps.signals.models import ConfidenceLevel, SeverityLevel


DEFAULT_RULES = [
    {
        "name": "Escalating movement corridor",
        "description": "Detect repeated suspicious movement in a corridor over a short period.",
        "min_confidence": ConfidenceLevel.EMERGING,
        "min_severity": SeverityLevel.MEDIUM,
        "threshold_count": 3,
        "radius_meters": 5000,
        "window_minutes": 180,
    },
    {
        "name": "High severity critical signal",
        "description": "Raise alerts for severe corroborated signals immediately.",
        "min_confidence": ConfidenceLevel.CORROBORATED,
        "min_severity": SeverityLevel.HIGH,
        "threshold_count": 1,
        "radius_meters": 2000,
        "window_minutes": 60,
    },
]


class Command(BaseCommand):
    help = "Create baseline alert rules for a fresh AegisMap deployment."

    def handle(self, *args, **options):
        created = 0
        for payload in DEFAULT_RULES:
            _, was_created = AlertRule.objects.get_or_create(
                name=payload["name"],
                defaults=payload,
            )
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Bootstrap complete. Created {created} alert rule(s)."))
