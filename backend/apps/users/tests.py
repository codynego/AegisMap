from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from apps.users.models import UserProfile, UserRole

User = get_user_model()


@override_settings(ALLOWED_HOSTS=["testserver"])
class AuthFlowTests(TestCase):
    def test_register_creates_default_role_and_token(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new_reporter",
                "email": "new_reporter@example.com",
                "password": "strongpass123",
                "display_name": "New Reporter",
                "role": "admin",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertIn("token", payload)
        self.assertEqual(payload["user"]["username"], "new_reporter")
        self.assertEqual(
            payload["user"]["profile"]["role"],
            "regular_user",
        )


@override_settings(ALLOWED_HOSTS=["testserver"])
class DashboardAccessTests(TestCase):
    def test_dashboard_summary_requires_authenticated_user(self):
        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, 403)

    def test_dashboard_summary_blocks_public_user_role(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "public_summary",
                "email": "public_summary@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, 403)

    def test_dashboard_summary_returns_operational_data(self):
        user = User.objects.create_user(username="ops_summary", password="strongpass123")
        UserProfile.objects.create(user=user, role=UserRole.ANALYST, display_name="Ops Summary")
        token = Token.objects.create(user=user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token.key}"

        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("totals", payload)
        self.assertIn("recent_alerts", payload)

    def test_health_endpoint_is_public(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)


@override_settings(ALLOWED_HOSTS=["testserver"])
class CommunityReporterApplicationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="public_user",
            email="public_user@example.com",
            password="strongpass123",
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            role=UserRole.REGULAR_USER,
            is_active_operator=True,
        )
        token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token.key}"

    def test_apply_community_reporter_upgrades_active_regular_user(self):
        response = self.client.post("/api/auth/apply-community-reporter/")

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.role, UserRole.COMMUNITY_REPORTER)
        payload = response.json()
        self.assertEqual(payload["user"]["profile"]["role"], UserRole.COMMUNITY_REPORTER)

    def test_apply_community_reporter_blocks_inactive_regular_user(self):
        self.profile.is_active_operator = False
        self.profile.save(update_fields=["is_active_operator"])

        response = self.client.post("/api/auth/apply-community-reporter/")

        self.assertEqual(response.status_code, 400)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.role, UserRole.REGULAR_USER)


@override_settings(ALLOWED_HOSTS=["testserver"])
class CurrentUserPreferenceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="prefs_user",
            email="prefs@example.com",
            password="strongpass123",
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            role=UserRole.COMMUNITY_REPORTER,
            metadata={},
        )
        token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token.key}"

    def test_user_can_patch_own_alert_preferences(self):
        response = self.client.patch(
            "/api/auth/me/",
            {
                "metadata": {
                    "watched_areas": ["Lagos", "Ogun"],
                    "saved_routes": ["Lekki - Epe", "Abuja Airport Road"],
                    "minimum_alert_severity": "high",
                }
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.metadata["watched_areas"], ["Lagos", "Ogun"])
        self.assertEqual(self.profile.metadata["saved_routes"], ["Lekki - Epe", "Abuja Airport Road"])
        self.assertEqual(self.profile.metadata["minimum_alert_severity"], "high")
