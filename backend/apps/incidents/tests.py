from django.test import TestCase, override_settings

from django.utils import timezone

from apps.incidents.models import Incident, Pattern, SignalCluster
from apps.incidents.services import calculate_incident_visibility_score
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

    def test_analyst_queue_hides_incidents_already_voted_on_by_same_user(self):
        self.client.login(username="analyst", password="pass")
        self.incident.status = "probable"
        self.incident.metadata = {
            "verification_events": [
                {
                    "user_id": self.analyst.id,
                    "response": "confirm",
                    "weight": 8,
                }
            ]
        }
        self.incident.save(update_fields=["status", "metadata", "updated_at"])

        res = self.client.get("/api/incidents/?verification_queue=true")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        results = payload.get("results", payload)
        returned_ids = {str(item["id"]) for item in results}
        self.assertNotIn(str(self.incident.id), returned_ids)

    def test_regular_users_do_not_see_decayed_incidents_in_list(self):
        self.client.login(username="regular", password="pass")
        self.incident.status = "verified"
        self.incident.metadata = {
            "decay_started_at": (timezone.now() - timezone.timedelta(days=15)).isoformat(),
            "last_reconfirmed_at": (timezone.now() - timezone.timedelta(days=15)).isoformat(),
        }
        self.incident.save(update_fields=["status", "metadata", "updated_at"])

        self.assertEqual(calculate_incident_visibility_score(self.incident), 0.0)
        res = self.client.get("/api/incidents/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        results = payload.get("results", payload)
        returned_ids = {str(item["id"]) for item in results}
        self.assertNotIn(str(self.incident.id), returned_ids)

    def test_analysts_see_decayed_incidents_in_list(self):
        self.client.login(username="analyst", password="pass")
        self.incident.status = "verified"
        self.incident.metadata = {
            "decay_started_at": (timezone.now() - timezone.timedelta(days=15)).isoformat(),
            "last_reconfirmed_at": (timezone.now() - timezone.timedelta(days=15)).isoformat(),
        }
        self.incident.save(update_fields=["status", "metadata", "updated_at"])

        self.assertEqual(calculate_incident_visibility_score(self.incident), 0.0)
        res = self.client.get("/api/incidents/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        results = payload.get("results", payload)
        returned_ids = {str(item["id"]) for item in results}
        self.assertIn(str(self.incident.id), returned_ids)

    def test_admin_can_remove_incident_from_map(self):
        self.client.login(username="admin", password="pass")
        self.incident.status = "active"
        self.incident.save(update_fields=["status", "updated_at"])

        res = self.client.post(f"/api/incidents/{self.incident.id}/remove_from_map/")
        self.assertEqual(res.status_code, 200)
        self.incident.refresh_from_db()
        self.assertTrue(self.incident.metadata.get("hidden_from_map"))

    def test_public_safety_summary_is_sanitized_and_excludes_sensitive_incidents(self):
        self.incident.title = "Road closure near bypass"
        self.incident.incident_type = "road_obstruction"
        self.incident.confidence = "high"
        self.incident.status = "active"
        self.incident.latitude = "6.524400"
        self.incident.longitude = "3.379200"
        self.incident.metadata = {"location_state": "Lagos"}
        self.incident.save(
            update_fields=["title", "incident_type", "confidence", "status", "latitude", "longitude", "metadata", "updated_at"]
        )

        Incident.objects.create(
            title="Sensitive kidnapping report",
            incident_type="kidnapping",
            confidence="high",
            status="active",
            latitude="6.600000",
            longitude="3.400000",
            metadata={"location_state": "Lagos"},
        )

        res = self.client.get("/api/public/safety-summary/")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        incidents = payload["incidents"]
        titles = {item["title"] for item in incidents}
        self.assertIn("Road closure near bypass", titles)
        self.assertNotIn("Sensitive kidnapping report", titles)

        public_incident = next(item for item in incidents if item["title"] == "Road closure near bypass")
        self.assertEqual(public_incident["location_name"], "Lagos area")
        self.assertEqual(public_incident["latitude"], 6.5)
        self.assertEqual(public_incident["longitude"], 3.4)

    def test_incident_list_supports_location_and_date_filters_for_analysts(self):
        self.client.login(username="analyst", password="pass")
        self.incident.title = "Flooded underpass"
        self.incident.incident_type = "flooding"
        self.incident.confidence = "high"
        self.incident.status = "active"
        self.incident.location_name = "Allen Avenue, Lagos"
        self.incident.metadata = {"location_state": "Lagos", "signal_count": 4, "confidence_score": 0.82}
        self.incident.detected_at = timezone.now()
        self.incident.save(
            update_fields=[
                "title",
                "incident_type",
                "confidence",
                "status",
                "location_name",
                "metadata",
                "detected_at",
                "updated_at",
            ]
        )

        other_incident = Incident.objects.create(
            title="Old Benin obstruction",
            incident_type="road_obstruction",
            confidence="high",
            status="active",
            location_name="Benin bypass",
            metadata={"location_state": "Edo"},
        )
        other_incident.detected_at = timezone.now() - timezone.timedelta(days=10)
        other_incident.save(update_fields=["detected_at", "updated_at"])

        date_from = (timezone.localdate() - timezone.timedelta(days=1)).isoformat()
        date_to = (timezone.localdate() + timezone.timedelta(days=1)).isoformat()
        res = self.client.get(f"/api/incidents/?location=Lagos&date_from={date_from}&date_to={date_to}")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        results = payload.get("results", payload)
        returned_ids = {str(item["id"]) for item in results}
        self.assertIn(str(self.incident.id), returned_ids)
        self.assertNotIn(str(other_incident.id), returned_ids)

        incident_payload = next(item for item in results if str(item["id"]) == str(self.incident.id))
        self.assertEqual(incident_payload["signal_count"], 4)
        self.assertEqual(incident_payload["confidence_score"], 82.0)

    def test_incident_vote_updates_management_fields(self):
        self.client.login(username="analyst", password="pass")
        self.incident.confidence = "emerging"
        self.incident.status = "probable"
        self.incident.metadata = {"signal_count": 1}
        self.incident.save(update_fields=["confidence", "status", "metadata", "updated_at"])

        vote_response = self.client.post(
            f"/api/incidents/{self.incident.id}/submit_verification/",
            {"response": "confirm"},
            content_type="application/json",
        )
        self.assertEqual(vote_response.status_code, 200)

        detail_response = self.client.get(f"/api/incidents/{self.incident.id}/")
        self.assertEqual(detail_response.status_code, 200)
        incident_payload = detail_response.json()
        self.assertEqual(incident_payload["verification_summary"]["total_votes"], 1)
        self.assertEqual(incident_payload["verification_summary"]["confirm_count"], 1)
        self.assertEqual(incident_payload["verification_summary"]["trusted_confirmations"], 1)
        self.assertIsInstance(incident_payload["confidence_score"], float)
