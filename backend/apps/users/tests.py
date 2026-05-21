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
            "community_reporter",
        )


@override_settings(ALLOWED_HOSTS=["testserver"])
class DashboardAccessTests(TestCase):
    def test_dashboard_summary_requires_authenticated_user(self):
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
