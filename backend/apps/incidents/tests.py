from django.test import TestCase, override_settings

from apps.incidents.models import Incident, Pattern, SignalCluster
from apps.signals.models import Signal


@override_settings(ALLOWED_HOSTS=["testserver"])
class IntelligencePromotionTests(TestCase):
    def test_related_signals_create_cluster_pattern_and_incident(self):
        payloads = [
            {
                "title": "Movement report 1",
                "description": "Night movement on route.",
                "category": "suspicious_activity",
                "severity": "medium",
                "latitude": "9.076500",
                "longitude": "7.398600",
                "occurred_at": "2026-05-21T01:00:00Z",
            },
            {
                "title": "Movement report 2",
                "description": "Another movement report nearby.",
                "category": "suspicious_activity",
                "severity": "high",
                "latitude": "9.076900",
                "longitude": "7.398900",
                "occurred_at": "2026-05-21T02:00:00Z",
            },
            {
                "title": "Movement report 3",
                "description": "Third corroborating signal nearby.",
                "category": "suspicious_activity",
                "severity": "critical",
                "latitude": "9.077100",
                "longitude": "7.399100",
                "occurred_at": "2026-05-21T03:00:00Z",
            },
        ]

        for payload in payloads:
            response = self.client.post("/api/signals/", payload, content_type="application/json")
            self.assertEqual(response.status_code, 201)

        self.assertEqual(SignalCluster.objects.count(), 1)
        self.assertEqual(Pattern.objects.count(), 1)
        self.assertEqual(Incident.objects.count(), 1)
        self.assertEqual(Signal.objects.filter(status="escalated").count(), 3)
