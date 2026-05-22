from django.test import TestCase, override_settings

from apps.alerts.models import Alert
from apps.risk.models import RiskSnapshot, WatchZone
from apps.signals.models import SignalIngestionJob


@override_settings(ALLOWED_HOSTS=["testserver"])
class SignalIntelligenceFlowTests(TestCase):
    def test_anonymous_signal_updates_watch_zone_risk(self):
        watch_zone = WatchZone.objects.create(
            name="Test Zone",
            centroid_latitude="9.076500",
            centroid_longitude="7.398600",
            metadata={"radius_meters": 5000},
        )

        response = self.client.post(
            "/api/signals/",
            {
                "title": "Suspicious movement",
                "description": "Repeated motorcycle movement reported at night.",
                "category": "suspicious_activity",
                "severity": "critical",
                "latitude": "9.077000",
                "longitude": "7.399000",
                "route_hint": "Northern bush road",
                "occurred_at": "2026-05-21T01:30:00Z",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        watch_zone.refresh_from_db()
        self.assertGreater(float(watch_zone.current_risk_score), 0.0)
        self.assertEqual(RiskSnapshot.objects.filter(watch_zone=watch_zone).count(), 1)
        self.assertEqual(Alert.objects.filter(watch_zone=watch_zone).count(), 1)

    def test_ingestion_job_creates_signals(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "ingest_user",
                "email": "ingest@example.com",
                "password": "strongpass123",
            },
        )
        token = response.json()["token"]

        from django.contrib.auth import get_user_model

        user = get_user_model().objects.get(username="ingest_user")
        profile = user.profile
        profile.role = "analyst"
        profile.save(update_fields=["role"])
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        response = self.client.post(
            "/api/signal-ingestion-jobs/",
            {
                "source_type": "bulk",
                "name": "Bulk import",
                "payload": {
                    "signals": [
                        {
                            "title": "Bulk signal",
                            "description": "Imported signal",
                            "category": "suspicious_activity",
                            "severity": "low",
                        }
                    ]
                },
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        job = SignalIngestionJob.objects.get(name="Bulk import")
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.processed_count, 1)
