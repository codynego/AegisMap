from django.test import TestCase, override_settings

from apps.incidents.models import Incident, Pattern, SignalCluster
from apps.signals.models import Signal
from rest_framework.test import APIClient


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


class IncidentApproveTests(TestCase):
    def setUp(self):
        # create users
        from django.contrib.auth import get_user_model
        from apps.users.models import UserProfile, UserRole

        User = get_user_model()
        self.admin = User.objects.create_user(username="admin", password="pass")
        UserProfile.objects.create(user=self.admin, role=UserRole.ADMIN)

        self.analyst = User.objects.create_user(username="analyst", password="pass")
        UserProfile.objects.create(user=self.analyst, role=UserRole.ANALYST)

        self.regular = User.objects.create_user(username="regular", password="pass")
        UserProfile.objects.create(user=self.regular, role=UserRole.COMMUNITY_REPORTER)

        self.client = APIClient()
        self.incident = Incident.objects.create(title="Test Incident", incident_type="suspicious_activity", summary="test")

    def test_admin_can_approve(self):
        self.client.login(username="admin", password="pass")
        res = self.client.post(f"/api/incidents/{self.incident.id}/approve/")
        self.assertEqual(res.status_code, 200)
        self.incident.refresh_from_db()
        self.assertEqual(self.incident.confidence, "high")

    def test_analyst_cannot_approve(self):
        self.client.login(username="analyst", password="pass")
        res = self.client.post(f"/api/incidents/{self.incident.id}/approve/")
        self.assertEqual(res.status_code, 403)

    def test_regular_cannot_approve(self):
        self.client.login(username="regular", password="pass")
        res = self.client.post(f"/api/incidents/{self.incident.id}/approve/")
        self.assertEqual(res.status_code, 403)
