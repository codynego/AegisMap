from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta

from apps.alerts.models import Alert
from apps.risk.models import RiskSnapshot, WatchZone
from apps.signals.models import Signal, SignalIngestionJob, VerificationResponse
from apps.signals.services import _confidence_decay_penalty, submit_signal_verification
from apps.users.models import UserRole


@override_settings(ALLOWED_HOSTS=["testserver"])
class SignalIntelligenceFlowTests(TestCase):
    def test_signal_rejects_future_occurred_at(self):
        future_time = (timezone.now() + timedelta(hours=2)).isoformat()

        response = self.client.post(
            "/api/signals/",
            {
                "title": "Future-dated report",
                "description": "This should be rejected.",
                "category": "suspicious_activity",
                "severity": "medium",
                "occurred_at": future_time,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("occurred_at", response.json())

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

    def test_weighted_verification_raises_confidence_for_supported_signal(self):
        reporter_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "reporter",
                "email": "reporter@example.com",
                "password": "strongpass123",
            },
        )
        verifier_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "verifier",
                "email": "verifier@example.com",
                "password": "strongpass123",
            },
        )
        self.assertEqual(reporter_response.status_code, 201)
        self.assertEqual(verifier_response.status_code, 201)

        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        verifier = user_model.objects.get(username="verifier")
        verifier.profile.role = UserRole.TRUSTED_VERIFIER
        verifier.profile.save(update_fields=["role"])

        reporter_token = reporter_response.json()["token"]
        signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Flooding on Airport Road",
                "description": "Road is partially underwater.",
                "category": "flooding",
                "severity": "medium",
                "latitude": "9.077000",
                "longitude": "7.399000",
                "occurred_at": "2026-05-21T01:30:00Z",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {reporter_token}",
        )
        self.assertEqual(signal_response.status_code, 201)
        signal_id = signal_response.json()["id"]

        verifier_token = verifier_response.json()["token"]
        verification_response = self.client.post(
            f"/api/signals/{signal_id}/submit_verification/",
            {
                "response": "confirm",
                "distance_meters": 800,
                "note": "Confirmed nearby floodwater.",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {verifier_token}",
        )
        self.assertEqual(verification_response.status_code, 200)

        signal = Signal.objects.get(pk=signal_id)
        summary = signal.metadata.get("verification_summary", {})
        self.assertGreaterEqual(signal.metadata.get("confidence_score", 0), 0.65)
        self.assertIn(signal.confidence, {"corroborated", "high"})
        self.assertEqual(summary.get("confirm_count"), 1)
        self.assertGreater(summary.get("confirm_weight", 0), 5)

    def test_sensitive_signal_requires_more_than_single_confirmation(self):
        reporter_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "sensitive_reporter",
                "email": "sensitive_reporter@example.com",
                "password": "strongpass123",
            },
        )
        verifier_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "sensitive_verifier",
                "email": "sensitive_verifier@example.com",
                "password": "strongpass123",
            },
        )
        self.assertEqual(reporter_response.status_code, 201)
        self.assertEqual(verifier_response.status_code, 201)

        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        verifier = user_model.objects.get(username="sensitive_verifier")
        verifier.profile.role = UserRole.TRUSTED_VERIFIER
        verifier.profile.save(update_fields=["role"])

        reporter_token = reporter_response.json()["token"]
        signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Possible kidnapping near bypass",
                "description": "Vehicle forced someone into a van.",
                "category": "kidnapping",
                "severity": "critical",
                "latitude": "9.177000",
                "longitude": "7.499000",
                "occurred_at": "2026-05-21T01:30:00Z",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {reporter_token}",
        )
        self.assertEqual(signal_response.status_code, 201)
        signal_id = signal_response.json()["id"]

        verifier_token = verifier_response.json()["token"]
        verification_response = self.client.post(
            f"/api/signals/{signal_id}/submit_verification/",
            {
                "response": "confirm",
                "distance_meters": 500,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {verifier_token}",
        )
        self.assertEqual(verification_response.status_code, 200)

        signal = Signal.objects.get(pk=signal_id)
        self.assertLess(signal.metadata.get("confidence_score", 1), 0.65)
        self.assertIn(signal.confidence, {"low", "emerging"})

    def test_duplicate_signal_is_auto_merged_during_ingest(self):
        first_response = self.client.post(
            "/api/signals/",
            {
                "title": "Flooding on Airport Road",
                "description": "Water has covered one lane.",
                "category": "flooding",
                "severity": "medium",
                "location_name": "Airport Road",
                "latitude": "9.077000",
                "longitude": "7.399000",
                "occurred_at": "2026-05-21T01:30:00Z",
            },
            content_type="application/json",
        )
        self.assertEqual(first_response.status_code, 201)
        canonical_id = first_response.json()["id"]

        duplicate_response = self.client.post(
            "/api/signals/",
            {
                "title": "Airport Road flood report",
                "description": "Same flood seen nearby.",
                "category": "flooding",
                "severity": "medium",
                "location_name": "Airport Road",
                "latitude": "9.077200",
                "longitude": "7.399100",
                "occurred_at": "2026-05-21T02:00:00Z",
            },
            content_type="application/json",
        )
        self.assertEqual(duplicate_response.status_code, 201)

        duplicate_signal = Signal.objects.get(pk=duplicate_response.json()["id"])
        canonical_signal = Signal.objects.get(pk=canonical_id)

        self.assertEqual(duplicate_signal.status, "dismissed")
        self.assertEqual(duplicate_signal.metadata.get("duplicate_of"), canonical_id)
        self.assertTrue(duplicate_signal.metadata.get("auto_merged"))
        self.assertIn(str(duplicate_signal.pk), canonical_signal.metadata.get("duplicate_signal_ids", []))
        self.assertEqual(canonical_signal.metadata.get("duplicate_report_count"), 1)

    def test_public_user_only_sees_own_signals(self):
        first_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "public_signal_owner",
                "email": "public_signal_owner@example.com",
                "password": "strongpass123",
            },
        )
        second_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "public_signal_other",
                "email": "public_signal_other@example.com",
                "password": "strongpass123",
            },
        )
        first_token = first_response.json()["token"]
        second_token = second_response.json()["token"]

        from django.contrib.auth import get_user_model

        first_user = get_user_model().objects.get(username="public_signal_owner")
        first_user.profile.role = UserRole.COMMUNITY_REPORTER
        first_user.profile.save(update_fields=["role"])
        second_user = get_user_model().objects.get(username="public_signal_other")
        second_user.profile.role = UserRole.COMMUNITY_REPORTER
        second_user.profile.save(update_fields=["role"])

        own_signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "My own report",
                "description": "Owned by first user.",
                "category": "flooding",
                "severity": "medium",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {first_token}",
        )
        other_signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Someone else's report",
                "description": "Owned by second user.",
                "category": "flooding",
                "severity": "medium",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {second_token}",
        )
        self.assertEqual(own_signal_response.status_code, 201)
        self.assertEqual(other_signal_response.status_code, 201)

        verified_response = self.client.post(
            "/api/signals/",
            {
                "title": "Verified flood alert",
                "description": "A confirmed nearby flood report.",
                "category": "flooding",
                "severity": "medium",
                "confidence": "corroborated",
                "status": "triaged",
            },
            content_type="application/json",
        )
        self.assertEqual(verified_response.status_code, 201)
        verified_signal = Signal.objects.get(pk=verified_response.json()["id"])
        verified_signal.confidence = "corroborated"
        verified_signal.status = "triaged"
        verified_signal.save(update_fields=["confidence", "status", "updated_at"])

        list_response = self.client.get("/api/signals/", HTTP_AUTHORIZATION=f"Token {first_token}")
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        results = payload.get("results", payload)
        returned_ids = {item["id"] for item in results}
        self.assertIn(own_signal_response.json()["id"], returned_ids)
        self.assertIn(verified_response.json()["id"], returned_ids)
        self.assertNotIn(other_signal_response.json()["id"], returned_ids)

    def test_public_reporters_can_submit_verification(self):
        reporter_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "public_verifier",
                "email": "public_verifier@example.com",
                "password": "strongpass123",
            },
        )
        token = reporter_response.json()["token"]

        signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Road obstruction near market",
                "description": "Large branch blocking the road.",
                "category": "road_obstruction",
                "severity": "medium",
            },
            content_type="application/json",
        )
        self.assertEqual(signal_response.status_code, 201)

        verification_response = self.client.post(
            f"/api/signals/{signal_response.json()['id']}/submit_verification/",
            {
                "response": "confirm",
                "note": "Confirmed from nearby location.",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {token}",
        )
        self.assertEqual(verification_response.status_code, 200)

    def test_trusted_reporter_can_access_verification_queue_but_not_general_raw_feed(self):
        reporter_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "queue_reporter",
                "email": "queue_reporter@example.com",
                "password": "strongpass123",
            },
        )
        verifier_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "queue_trusted",
                "email": "queue_trusted@example.com",
                "password": "strongpass123",
            },
        )

        from django.contrib.auth import get_user_model

        trusted_user = get_user_model().objects.get(username="queue_trusted")
        trusted_user.profile.role = UserRole.TRUSTED_VERIFIER
        trusted_user.profile.save(update_fields=["role"])

        report_token = reporter_response.json()["token"]
        trusted_token = verifier_response.json()["token"]
        signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Need confirmation",
                "description": "Unconfirmed route issue.",
                "category": "unsafe_route",
                "severity": "medium",
                "latitude": "9.077000",
                "longitude": "7.399000",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {report_token}",
        )
        self.assertEqual(signal_response.status_code, 201)

        default_list_response = self.client.get("/api/signals/", HTTP_AUTHORIZATION=f"Token {trusted_token}")
        self.assertEqual(default_list_response.status_code, 200)
        self.assertEqual(default_list_response.json().get("results", []), [])

        queue_response = self.client.get(
            "/api/signals/?verification_queue=true",
            HTTP_AUTHORIZATION=f"Token {trusted_token}",
        )
        self.assertEqual(queue_response.status_code, 200)
        payload = queue_response.json().get("results", [])
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], signal_response.json()["id"])

    def test_trusted_reporter_queue_hides_reports_already_voted_on(self):
        reporter_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "queue_owner",
                "email": "queue_owner@example.com",
                "password": "strongpass123",
            },
        )
        verifier_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "queue_voter",
                "email": "queue_voter@example.com",
                "password": "strongpass123",
            },
        )

        from django.contrib.auth import get_user_model

        trusted_user = get_user_model().objects.get(username="queue_voter")
        trusted_user.profile.role = UserRole.TRUSTED_VERIFIER
        trusted_user.profile.save(update_fields=["role"])

        report_token = reporter_response.json()["token"]
        trusted_token = verifier_response.json()["token"]
        signal_response = self.client.post(
            "/api/signals/",
            {
                "title": "Queue vote hide check",
                "description": "Should disappear after vote.",
                "category": "unsafe_route",
                "severity": "medium",
                "latitude": "9.077000",
                "longitude": "7.399000",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {report_token}",
        )
        signal_id = signal_response.json()["id"]

        vote_response = self.client.post(
            f"/api/signals/{signal_id}/submit_verification/",
            {"response": "confirm"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {trusted_token}",
        )
        self.assertEqual(vote_response.status_code, 200)

        queue_response = self.client.get(
            "/api/signals/?verification_queue=true",
            HTTP_AUTHORIZATION=f"Token {trusted_token}",
        )
        self.assertEqual(queue_response.status_code, 200)
        payload = queue_response.json().get("results", [])
        returned_ids = {item["id"] for item in payload}
        self.assertNotIn(signal_id, returned_ids)

    def test_decay_only_resets_on_confirming_reconfirmation(self):
        signal = Signal.objects.create(
            title="Old route report",
            description="Old report that should decay.",
            category="unsafe_route",
            severity="medium",
            occurred_at=timezone.now() - timezone.timedelta(days=10),
        )

        initial_penalty = _confidence_decay_penalty(signal, {"confirm_count": 0})
        self.assertGreater(initial_penalty, 0)

        deny_user_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "deny_voter",
                "email": "deny_voter@example.com",
                "password": "strongpass123",
            },
        )
        self.assertEqual(deny_user_response.status_code, 201)
        from django.contrib.auth import get_user_model
        deny_user = get_user_model().objects.get(username="deny_voter")
        submit_signal_verification(signal=signal, user=deny_user, response=VerificationResponse.DENY)
        signal.refresh_from_db()

        deny_penalty = _confidence_decay_penalty(signal, {"confirm_count": 0})
        self.assertEqual(deny_penalty, initial_penalty)

        confirm_user_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "confirm_voter",
                "email": "confirm_voter@example.com",
                "password": "strongpass123",
            },
        )
        self.assertEqual(confirm_user_response.status_code, 201)
        confirm_user = get_user_model().objects.get(username="confirm_voter")
        submit_signal_verification(signal=signal, user=confirm_user, response=VerificationResponse.CONFIRM)
        signal.refresh_from_db()

        confirm_penalty = _confidence_decay_penalty(signal, {"confirm_count": 1})
        self.assertEqual(confirm_penalty, 0)
