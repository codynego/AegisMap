from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token

from apps.alerts.models import Alert
from apps.geofences.models import Geofence
from apps.signals.models import Signal
from apps.users.models import UserProfile, UserRole

User = get_user_model()


@override_settings(ALLOWED_HOSTS=["testserver"])
class AlertWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="analyst_alerts", password="strongpass123")
        UserProfile.objects.create(user=self.user, role=UserRole.ANALYST, display_name="Alert Analyst")
        self.token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"

    def test_alert_can_be_acknowledged_and_resolved(self):
        alert = Alert.objects.create(
            title="Risk changed for Route A",
            message="Risk increased because of nearby signals.",
            severity="high",
        )
        acknowledge = self.client.post(f"/api/alerts/{alert.pk}/acknowledge/")
        self.assertEqual(acknowledge.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "acknowledged")

        resolve = self.client.post(f"/api/alerts/{alert.pk}/resolve/")
        self.assertEqual(resolve.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "resolved")

    def test_geofence_signal_creates_alert(self):
        Geofence.objects.create(
            name="Village Perimeter",
            geofence_type="village",
            centroid_latitude="9.076500",
            centroid_longitude="7.398600",
            radius_meters=5000,
            notify_on_signal=True,
        )

        response = self.client.post(
            "/api/signals/",
            {
                "title": "Suspicious campfire sighting",
                "description": "Campfire seen close to settlement boundary.",
                "category": "camp_indicator",
                "severity": "high",
                "latitude": "9.077000",
                "longitude": "7.399000",
                "occurred_at": "2026-05-21T02:00:00Z",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        signal = Signal.objects.get(title="Suspicious campfire sighting")
        self.assertTrue(
            Alert.objects.filter(
                title="Signal near Village Perimeter",
                metadata__signal_id=str(signal.pk),
            ).exists()
        )
