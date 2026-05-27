from django.test import TestCase, override_settings
from unittest.mock import patch

from apps.geofences.models import Geofence
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


@override_settings(ALLOWED_HOSTS=["testserver"])
class WeatherIntelligenceTests(TestCase):
    def setUp(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "weather_user",
                "email": "weather@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

    @patch("apps.risk.services._fetch_weather_rows")
    def test_weather_intelligence_endpoint_returns_overlay_route_and_risk_adjustments(self, mock_rows):
        mock_rows.return_value = [
            {
                "id": "incident-1",
                "latitude": 6.335,
                "longitude": 5.6037,
                "label": "Flood incident",
                "kind": "incident",
                "incident_type": "flood",
                "severity_hint": "high",
                "summary": "Flooding on the corridor",
                "location_name": "Benin City",
                "precipitation_mm": 11.5,
                "visibility_m": 2200.0,
                "weather_code": 65,
            },
            {
                "id": "watch-zone-2",
                "latitude": 6.34,
                "longitude": 5.61,
                "label": "Benin Drainage Belt",
                "kind": "watch_zone",
                "incident_type": "",
                "severity_hint": "",
                "summary": "",
                "location_name": "",
                "precipitation_mm": 9.0,
                "visibility_m": 3500.0,
                "weather_code": 63,
            },
            {
                "id": "route-segment-0",
                "latitude": 6.3375,
                "longitude": 5.61185,
                "label": "Route segment 1",
                "kind": "route_segment",
                "incident_type": "",
                "severity_hint": "",
                "summary": "",
                "location_name": "",
                "precipitation_mm": 8.5,
                "visibility_m": 2800.0,
                "weather_code": 81,
            },
        ]

        response = self.client.post(
            "/api/weather-intelligence/",
            {
                "points": [
                    {
                        "id": "incident-1",
                        "latitude": 6.335,
                        "longitude": 5.6037,
                        "label": "Flood incident",
                        "kind": "incident",
                        "incident_type": "flood",
                        "severity": "high",
                        "summary": "Flooding on the corridor",
                        "location_name": "Benin City",
                    }
                ],
                "watch_zones": [
                    {
                        "id": "2",
                        "name": "Benin Drainage Belt",
                        "latitude": 6.34,
                        "longitude": 5.61,
                        "risk_level": "medium_risk",
                        "risk_score": 58,
                    }
                ],
                "route_path": [[5.6037, 6.335], [5.62, 6.34]],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["provider"], "Open-Meteo ECMWF")
        self.assertGreaterEqual(len(payload["overlay"]), 3)
        self.assertEqual(payload["incident_contexts"][0]["source_id"], "incident-1")
        self.assertTrue(payload["route"]["advisories"])
        self.assertEqual(payload["route"]["segments"][0]["severity"], "high")
        self.assertEqual(payload["risk_zone_adjustments"][0]["watch_zone_id"], "2")
        self.assertGreater(payload["risk_zone_adjustments"][0]["weather_adjusted_risk_score"], 58)


@override_settings(ALLOWED_HOSTS=["testserver"])
class WatchZoneCreationTests(TestCase):
    def setUp(self):
        register_response = self.client.post(
            "/api/auth/register/",
            {
                "username": "watch_area_user",
                "email": "watch-area@example.com",
                "password": "strongpass123",
            },
        )
        token = register_response.json()["token"]
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {token}"

    def test_user_can_create_watch_zone_directly(self):
        payload = {
            "name": "Watch area · 6.4501, 5.5971",
            "zone_type": "watch_area",
            "status": "active",
            "current_risk_level": "baseline",
            "current_risk_score": 0,
            "centroid_latitude": 6.4501,
            "centroid_longitude": 5.5971,
            "boundary": {},
            "notes": "Created from a dropped pin in live intelligence.",
            "metadata": {
                "created_from": "live_intelligence_pin",
                "pin_action": "watch_zone",
                "radius_meters": 500,
            },
        }

        response = self.client.post("/api/watch-zones/", payload, content_type="application/json")
        self.assertEqual(response.status_code, 201)

        watch_zone = WatchZone.objects.get(name=payload["name"])
        self.assertEqual(watch_zone.zone_type, "watch_area")
        self.assertEqual(watch_zone.status, "active")
        self.assertEqual(watch_zone.metadata.get("created_from"), "live_intelligence_pin")
        self.assertEqual(watch_zone.metadata.get("pin_action"), "watch_zone")
        self.assertFalse(Geofence.objects.filter(name=payload["name"]).exists())
