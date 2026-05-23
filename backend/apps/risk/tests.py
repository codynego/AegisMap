from django.test import TestCase, override_settings

from apps.users.models import UserRole

from .models import WatchZone


@override_settings(ALLOWED_HOSTS=["testserver"])
class RiskForecastTests(TestCase):
    def test_risk_forecasts_endpoint_returns_pattern_based_forecasts(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "forecast_user",
                "email": "forecast@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        from django.contrib.auth import get_user_model

        analyst = get_user_model().objects.get(username="forecast_user")
        analyst.profile.role = UserRole.ANALYST
        analyst.profile.save(update_fields=["role"])

        WatchZone.objects.create(
            name="Airport Corridor",
            centroid_latitude="9.076500",
            centroid_longitude="7.398600",
            current_risk_score="68.00",
            current_risk_level="high_risk",
        )

        payloads = [
            {
                "title": "Robbery report 1",
                "description": "Late-night robbery on the corridor.",
                "category": "armed_robbery",
                "severity": "high",
                "location_name": "Airport Corridor",
                "latitude": "9.076500",
                "longitude": "7.398600",
                "occurred_at": "2026-05-21T21:00:00Z",
            },
            {
                "title": "Robbery report 2",
                "description": "Another robbery nearby.",
                "category": "armed_robbery",
                "severity": "high",
                "location_name": "Airport Corridor",
                "latitude": "9.076800",
                "longitude": "7.398900",
                "occurred_at": "2026-05-22T22:00:00Z",
            },
            {
                "title": "Gunshots heard",
                "description": "Gunshots reported near the same corridor.",
                "category": "gunshots_heard",
                "severity": "critical",
                "location_name": "Airport Corridor",
                "latitude": "9.077100",
                "longitude": "7.399100",
                "occurred_at": "2026-05-23T23:00:00Z",
            },
        ]

        for payload in payloads:
            response = self.client.post("/api/signals/", payload, content_type="application/json")
            self.assertEqual(response.status_code, 201)

        response = self.client.get("/api/risk-forecasts/")
        self.assertEqual(response.status_code, 200)
        forecasts = response.json()
        self.assertGreaterEqual(len(forecasts), 1)
        categories = {forecast["category"] for forecast in forecasts}
        self.assertTrue(categories & {"escalating_zone", "nighttime_risk", "route_instability", "emerging_hotspot"})
        self.assertIn("probability", forecasts[0])
        self.assertIn("confidence", forecasts[0])
        self.assertIn("summary", forecasts[0])

    def test_risk_forecasts_endpoint_can_filter_by_location(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "forecast_scope_user",
                "email": "forecast-scope@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        from django.contrib.auth import get_user_model

        analyst = get_user_model().objects.get(username="forecast_scope_user")
        analyst.profile.role = UserRole.ANALYST
        analyst.profile.save(update_fields=["role"])

        WatchZone.objects.create(
            name="Airport Corridor",
            centroid_latitude="9.076500",
            centroid_longitude="7.398600",
            current_risk_score="68.00",
            current_risk_level="high_risk",
        )
        WatchZone.objects.create(
            name="Lokoja Axis",
            centroid_latitude="7.802300",
            centroid_longitude="6.743000",
            current_risk_score="64.00",
            current_risk_level="high_risk",
        )

        nearby_payloads = [
            {
                "title": "Corridor robbery 1",
                "description": "Robbery near the corridor.",
                "category": "armed_robbery",
                "severity": "high",
                "location_name": "Airport Corridor",
                "latitude": "9.076500",
                "longitude": "7.398600",
                "occurred_at": "2026-05-21T21:00:00Z",
            },
            {
                "title": "Corridor robbery 2",
                "description": "Another robbery near the corridor.",
                "category": "armed_robbery",
                "severity": "high",
                "location_name": "Airport Corridor",
                "latitude": "9.076800",
                "longitude": "7.398900",
                "occurred_at": "2026-05-22T22:00:00Z",
            },
        ]
        distant_payloads = [
            {
                "title": "Lokoja kidnapping 1",
                "description": "Suspicious escalation on another corridor.",
                "category": "kidnapping",
                "severity": "critical",
                "location_name": "Lokoja Axis",
                "latitude": "7.802300",
                "longitude": "6.743000",
                "occurred_at": "2026-05-21T20:00:00Z",
            },
            {
                "title": "Lokoja kidnapping 2",
                "description": "Second report in the Lokoja axis.",
                "category": "kidnapping",
                "severity": "critical",
                "location_name": "Lokoja Axis",
                "latitude": "7.802700",
                "longitude": "6.743400",
                "occurred_at": "2026-05-22T22:30:00Z",
            },
        ]

        for payload in nearby_payloads + distant_payloads:
            response = self.client.post("/api/signals/", payload, content_type="application/json")
            self.assertEqual(response.status_code, 201)

        response = self.client.get(
            "/api/risk-forecasts/",
            {
                "latitude": "9.076500",
                "longitude": "7.398600",
                "radius_km": "25",
            },
        )
        self.assertEqual(response.status_code, 200)
        forecasts = response.json()
        self.assertGreaterEqual(len(forecasts), 1)
        self.assertTrue(all(forecast["cluster_name"] == "Airport Corridor" for forecast in forecasts))

    def test_risk_forecasts_endpoint_requires_analyst_or_admin(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "public_forecast_user",
                "email": "public_forecast_user@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

        response = self.client.get("/api/risk-forecasts/")
        self.assertEqual(response.status_code, 403)
