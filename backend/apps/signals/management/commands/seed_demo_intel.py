from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.alerts.models import Alert, AlertRule
from apps.geofences.models import Geofence, GeofenceType
from apps.incidents.models import (
    Incident,
    IncidentStatus,
    IncidentType,
    Pattern,
    PatternStatus,
    SignalCluster,
)
from apps.risk.models import RiskLevel, RiskSnapshot, WatchZone, WatchZoneStatus
from apps.signals.models import ConfidenceLevel, SeverityLevel, Signal, SignalCategory, SignalStatus
from apps.users.models import ReliabilityBand, SourceProfile, SourceType, UserProfile, UserRole


DEMO_FLAG = {"demo_seed": True}
DEMO_USERNAME = "demo_analyst"
DEMO_PASSWORD = "GeoPulse123!"


def dec(value: str) -> Decimal:
    return Decimal(value)


class Command(BaseCommand):
    help = "Seed AegisMap with realistic demo intelligence data for the dashboard."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo-seeded records before recreating them.",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._clear_demo_data()

        now = timezone.now()
        user = self._ensure_demo_user()
        sources = self._ensure_sources(user, now)
        rules = self._ensure_alert_rules()
        geofences = self._ensure_geofences()
        watch_zones = self._ensure_watch_zones(now)
        clusters = self._ensure_clusters(now)
        patterns = self._ensure_patterns(clusters, now)
        signals = self._ensure_signals(user, sources, clusters, now)
        incidents = self._ensure_incidents(patterns, signals, now)
        self._ensure_risk_snapshots(watch_zones, patterns, incidents, now)
        alerts = self._ensure_alerts(rules, watch_zones, geofences, clusters, patterns, incidents, now)

        self.stdout.write(
            self.style.SUCCESS(
                "Demo intelligence ready: "
                f"{len(signals)} signals, {len(incidents)} incidents, {len(watch_zones)} watch zones, {len(alerts)} alerts."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"Login with username '{DEMO_USERNAME}' and password '{DEMO_PASSWORD}'."
            )
        )

    def _clear_demo_data(self):
        Alert.objects.filter(metadata__demo_seed=True).delete()
        RiskSnapshot.objects.filter(
            watch_zone__metadata__demo_seed=True
        ).delete()
        Incident.objects.filter(metadata__demo_seed=True).delete()
        Signal.objects.filter(metadata__demo_seed=True).delete()
        Pattern.objects.filter(metadata__demo_seed=True).delete()
        SignalCluster.objects.filter(metadata__demo_seed=True).delete()
        WatchZone.objects.filter(metadata__demo_seed=True).delete()
        Geofence.objects.filter(metadata__demo_seed=True).delete()
        SourceProfile.objects.filter(metadata__demo_seed=True).delete()
        get_user_model().objects.filter(username=DEMO_USERNAME).delete()

    def _ensure_demo_user(self):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=DEMO_USERNAME,
            defaults={
                "email": "demo.analyst@geopulse.local",
                "first_name": "GeoPulse",
                "last_name": "Analyst",
            },
        )
        user.set_password(DEMO_PASSWORD)
        user.is_staff = True
        user.save(update_fields=["password", "is_staff"])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "display_name": "GeoPulse Demo Analyst",
                "role": UserRole.ANALYST,
                "organization": "GeoPulse AI Demo Cell",
                "region_name": "Lagos - Abuja - Kaduna Corridor",
                "is_active_operator": True,
                "metadata": DEMO_FLAG,
            },
        )
        return user

    def _ensure_sources(self, user, now):
        source_specs = [
            {
                "label": "Rapid Response Hotline",
                "source_type": SourceType.USER,
                "reliability_band": ReliabilityBand.HIGH,
                "trust_score": Decimal("0.84"),
                "report_count": 18,
                "verified_signal_count": 12,
            },
            {
                "label": "Northwest Civic Monitor",
                "source_type": SourceType.CIVIC_MONITOR,
                "reliability_band": ReliabilityBand.TRUSTED,
                "trust_score": Decimal("0.91"),
                "report_count": 41,
                "verified_signal_count": 33,
            },
            {
                "label": "Transport Union Watch",
                "source_type": SourceType.TRANSPORT,
                "reliability_band": ReliabilityBand.MODERATE,
                "trust_score": Decimal("0.72"),
                "report_count": 27,
                "verified_signal_count": 15,
            },
            {
                "label": "Drone Patrol Delta-4",
                "source_type": SourceType.DRONE,
                "reliability_band": ReliabilityBand.TRUSTED,
                "trust_score": Decimal("0.95"),
                "report_count": 63,
                "verified_signal_count": 56,
            },
        ]

        sources = {}
        for spec in source_specs:
            source, _ = SourceProfile.objects.update_or_create(
                label=spec["label"],
                defaults={
                    "user": user,
                    "source_type": spec["source_type"],
                    "reliability_band": spec["reliability_band"],
                    "trust_score": spec["trust_score"],
                    "report_count": spec["report_count"],
                    "verified_signal_count": spec["verified_signal_count"],
                    "disputed_signal_count": 1,
                    "last_seen_at": now - timedelta(minutes=18),
                    "notes": "Demo seed source profile.",
                    "metadata": DEMO_FLAG,
                },
            )
            sources[spec["label"]] = source
        return sources

    def _ensure_alert_rules(self):
        defaults = [
            {
                "name": "High severity corroborated incident",
                "description": "Trigger when a high severity corroborated incident is detected.",
                "min_confidence": ConfidenceLevel.CORROBORATED,
                "min_severity": SeverityLevel.HIGH,
                "threshold_count": 1,
                "radius_meters": 2500,
                "window_minutes": 90,
            },
            {
                "name": "Escalating corridor activity",
                "description": "Trigger when repeated corridor signals escalate over a short window.",
                "min_confidence": ConfidenceLevel.EMERGING,
                "min_severity": SeverityLevel.MEDIUM,
                "threshold_count": 3,
                "radius_meters": 5000,
                "window_minutes": 180,
            },
        ]
        rules = {}
        for payload in defaults:
            rule, _ = AlertRule.objects.get_or_create(name=payload["name"], defaults=payload)
            rules[payload["name"]] = rule
        return rules

    def _ensure_geofences(self):
        specs = [
            {
                "name": "Lekki-Epe Expressway Corridor",
                "geofence_type": GeofenceType.HIGHWAY,
                "lat": dec("6.469800"),
                "lng": dec("3.585200"),
                "radius": 4200,
                "description": "High traffic route monitored for rapid incident escalation.",
            },
            {
                "name": "Abuja City Gate Perimeter",
                "geofence_type": GeofenceType.FACILITY,
                "lat": dec("8.946200"),
                "lng": dec("7.398600"),
                "radius": 2800,
                "description": "Strategic access control area.",
            },
        ]
        geofences = {}
        for spec in specs:
            geofence, _ = Geofence.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "geofence_type": spec["geofence_type"],
                    "centroid_latitude": spec["lat"],
                    "centroid_longitude": spec["lng"],
                    "radius_meters": spec["radius"],
                    "description": spec["description"],
                    "notify_on_signal": True,
                    "notify_on_incident": True,
                    "metadata": DEMO_FLAG,
                },
            )
            geofences[spec["name"]] = geofence
        return geofences

    def _ensure_watch_zones(self, now):
        specs = [
            {
                "name": "Lekki Peninsula",
                "zone_type": "urban_corridor",
                "risk": RiskLevel.HIGH,
                "score": Decimal("78.50"),
                "lat": dec("6.447400"),
                "lng": dec("3.535100"),
                "notes": "Repeated armed robbery and suspicious movement signals near commuter routes.",
            },
            {
                "name": "Abuja Southern Approach",
                "zone_type": "route_hub",
                "risk": RiskLevel.MEDIUM,
                "score": Decimal("64.20"),
                "lat": dec("8.913600"),
                "lng": dec("7.454700"),
                "notes": "Elevated approach risk with intermittent anomaly reports.",
            },
            {
                "name": "Kaduna Forest Edge",
                "zone_type": "rural_watch",
                "risk": RiskLevel.CRITICAL,
                "score": Decimal("91.40"),
                "lat": dec("10.492900"),
                "lng": dec("7.398600"),
                "notes": "High confidence threat clustering around forest ingress routes.",
            },
        ]
        zones = {}
        for spec in specs:
            zone, _ = WatchZone.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "zone_type": spec["zone_type"],
                    "status": WatchZoneStatus.ACTIVE,
                    "current_risk_level": spec["risk"],
                    "current_risk_score": spec["score"],
                    "centroid_latitude": spec["lat"],
                    "centroid_longitude": spec["lng"],
                    "notes": spec["notes"],
                    "metadata": DEMO_FLAG,
                    "last_evaluated_at": now - timedelta(minutes=12),
                },
            )
            zones[spec["name"]] = zone
        return zones

    def _ensure_clusters(self, now):
        specs = [
            {
                "name": "Lekki night movement cluster",
                "cluster_type": "movement",
                "confidence": ConfidenceLevel.CORROBORATED,
                "status": PatternStatus.MONITORING,
                "lat": dec("6.452100"),
                "lng": dec("3.558400"),
                "radius": 2200,
                "summary": "Night movement and robbery signals clustering along Lekki axis.",
            },
            {
                "name": "Kaduna forest ingress cluster",
                "cluster_type": "proximity",
                "confidence": ConfidenceLevel.HIGH,
                "status": PatternStatus.ESCALATED,
                "lat": dec("10.501800"),
                "lng": dec("7.412500"),
                "radius": 4800,
                "summary": "Multiple suspicious movement and camp indicators around the forest edge.",
            },
        ]
        clusters = {}
        for spec in specs:
            cluster, _ = SignalCluster.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "cluster_type": spec["cluster_type"],
                    "confidence": spec["confidence"],
                    "status": spec["status"],
                    "centroid_latitude": spec["lat"],
                    "centroid_longitude": spec["lng"],
                    "radius_meters": spec["radius"],
                    "started_at": now - timedelta(hours=spec["radius"] // 1000),
                    "last_seen_at": now - timedelta(minutes=18),
                    "summary": spec["summary"],
                    "metadata": DEMO_FLAG,
                },
            )
            clusters[spec["name"]] = cluster
        return clusters

    def _ensure_patterns(self, clusters, now):
        specs = [
            {
                "name": "Lekki commuter threat escalation",
                "cluster": clusters["Lekki night movement cluster"],
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.HIGH,
                "status": PatternStatus.MONITORING,
                "hint": "Lekki - Ajah evening route",
                "lat": dec("6.455300"),
                "lng": dec("3.566100"),
                "summary": "Escalating pattern of robbery reports and suspicious bike movement near commuter choke points.",
            },
            {
                "name": "Kaduna staging pattern",
                "cluster": clusters["Kaduna forest ingress cluster"],
                "confidence": ConfidenceLevel.HIGH,
                "severity": SeverityLevel.CRITICAL,
                "status": PatternStatus.ESCALATED,
                "hint": "Birnin Gwari forest ingress",
                "lat": dec("10.499500"),
                "lng": dec("7.405800"),
                "summary": "Repeated sightings, route indicators, and camp evidence suggest organized staging activity.",
            },
        ]
        patterns = {}
        for spec in specs:
            pattern, _ = Pattern.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "cluster": spec["cluster"],
                    "confidence": spec["confidence"],
                    "severity": spec["severity"],
                    "status": spec["status"],
                    "geographic_hint": spec["hint"],
                    "centroid_latitude": spec["lat"],
                    "centroid_longitude": spec["lng"],
                    "first_detected_at": now - timedelta(hours=9),
                    "last_detected_at": now - timedelta(minutes=20),
                    "summary": spec["summary"],
                    "metadata": DEMO_FLAG,
                },
            )
            patterns[spec["name"]] = pattern
        return patterns

    def _ensure_signals(self, user, sources, clusters, now):
        specs = [
            {
                "title": "Suspicious bikes near Lekki toll axis",
                "description": "Multiple motorcycles moving without lights and regrouping near the toll axis after 22:00.",
                "source": "Transport Union Watch",
                "cluster": "Lekki night movement cluster",
                "category": SignalCategory.SUSPICIOUS_MOVEMENT,
                "status": SignalStatus.CLUSTERED,
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.HIGH,
                "location": "Lekki Toll Axis, Lagos",
                "lat": dec("6.447900"),
                "lng": dec("3.565700"),
                "route": "Lekki - Ajah Corridor",
                "minutes_ago": 28,
            },
            {
                "title": "Armed robbery report at Admiralty Way slip road",
                "description": "Driver reports coordinated robbery attempt targeting vehicles slowing at the slip road.",
                "source": "Rapid Response Hotline",
                "cluster": "Lekki night movement cluster",
                "category": SignalCategory.ARMED_ROBBERY,
                "status": SignalStatus.ESCALATED,
                "confidence": ConfidenceLevel.HIGH,
                "severity": SeverityLevel.CRITICAL,
                "location": "Admiralty Way Slip Road, Lagos",
                "lat": dec("6.440500"),
                "lng": dec("3.447900"),
                "route": "Victoria Island - Lekki",
                "minutes_ago": 9,
            },
            {
                "title": "Thermal anomaly near Kaduna forest edge",
                "description": "Drone thermal scan picked up repeated heat signatures around a temporary clearing.",
                "source": "Drone Patrol Delta-4",
                "cluster": "Kaduna forest ingress cluster",
                "category": SignalCategory.CAMP_INDICATOR,
                "status": SignalStatus.ESCALATED,
                "confidence": ConfidenceLevel.HIGH,
                "severity": SeverityLevel.CRITICAL,
                "location": "Kaduna Forest Edge",
                "lat": dec("10.500800"),
                "lng": dec("7.413300"),
                "route": "Birnin Gwari Forest Track",
                "minutes_ago": 14,
            },
            {
                "title": "Abnormal sighting on Abuja southbound approach",
                "description": "Unmarked pickup observed stopping repeatedly along the approach corridor.",
                "source": "Northwest Civic Monitor",
                "cluster": None,
                "category": SignalCategory.ABNORMAL_SIGHTING,
                "status": SignalStatus.TRIAGED,
                "confidence": ConfidenceLevel.EMERGING,
                "severity": SeverityLevel.MEDIUM,
                "location": "Abuja Southern Approach",
                "lat": dec("8.914200"),
                "lng": dec("7.456300"),
                "route": "Airport - City Gate",
                "minutes_ago": 37,
            },
            {
                "title": "Flooded low-visibility segment near Third Mainland feeder",
                "description": "Standing water reducing visibility and forcing traffic bunching at the feeder segment.",
                "source": "Transport Union Watch",
                "cluster": None,
                "category": SignalCategory.FLOOD,
                "status": SignalStatus.TRIAGED,
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.MEDIUM,
                "location": "Third Mainland Feeder, Lagos",
                "lat": dec("6.507100"),
                "lng": dec("3.391900"),
                "route": "Third Mainland - Lagos Island",
                "minutes_ago": 52,
            },
            {
                "title": "Possible kidnapping setup near Kaduna bypass",
                "description": "Two vehicles reported shadowing private transport toward a low-coverage bypass segment.",
                "source": "Rapid Response Hotline",
                "cluster": "Kaduna forest ingress cluster",
                "category": SignalCategory.KIDNAPPING,
                "status": SignalStatus.ESCALATED,
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.HIGH,
                "location": "Kaduna Bypass Segment",
                "lat": dec("10.487400"),
                "lng": dec("7.390200"),
                "route": "Kaduna - Birnin Gwari",
                "minutes_ago": 21,
            },
        ]

        signals = []
        for spec in specs:
            signal, _ = Signal.objects.update_or_create(
                title=spec["title"],
                defaults={
                    "description": spec["description"],
                    "source_profile": sources[spec["source"]],
                    "submitted_by": user,
                    "cluster": clusters.get(spec["cluster"]) if spec["cluster"] else None,
                    "category": spec["category"],
                    "status": spec["status"],
                    "confidence": spec["confidence"],
                    "severity": spec["severity"],
                    "location_name": spec["location"],
                    "latitude": spec["lat"],
                    "longitude": spec["lng"],
                    "coordinate_precision_meters": 90,
                    "route_hint": spec["route"],
                    "occurred_at": now - timedelta(minutes=spec["minutes_ago"]),
                    "extracted_entities": [spec["location"], spec["route"]],
                    "metadata": DEMO_FLAG,
                },
            )
            Signal.objects.filter(pk=signal.pk).update(
                received_at=now - timedelta(minutes=max(1, spec["minutes_ago"] - 2)),
                created_at=now - timedelta(minutes=max(1, spec["minutes_ago"] - 2)),
                updated_at=now - timedelta(minutes=max(1, spec["minutes_ago"] - 1)),
            )
            signals.append(signal)
        return signals

    def _ensure_incidents(self, patterns, signals, now):
        signals_by_title = {signal.title: signal for signal in signals}
        specs = [
            {
                "title": "Armed robbery cluster near Lekki toll corridor",
                "type": IncidentType.ARMED_ROBBERY,
                "pattern": patterns["Lekki commuter threat escalation"],
                "signal": "Armed robbery report at Admiralty Way slip road",
                "confidence": ConfidenceLevel.HIGH,
                "severity": SeverityLevel.CRITICAL,
                "status": IncidentStatus.OPEN,
                "location": "Lekki Toll Corridor, Lagos",
                "lat": dec("6.445800"),
                "lng": dec("3.553000"),
                "summary": "Coordinated robbery activity reported across adjacent choke points with corroborating movement indicators.",
                "minutes_ago": 11,
            },
            {
                "title": "Kaduna forest edge staging activity",
                "type": IncidentType.THREAT_ACTIVITY,
                "pattern": patterns["Kaduna staging pattern"],
                "signal": "Thermal anomaly near Kaduna forest edge",
                "confidence": ConfidenceLevel.HIGH,
                "severity": SeverityLevel.CRITICAL,
                "status": IncidentStatus.MONITORING,
                "location": "Kaduna Forest Edge",
                "lat": dec("10.499600"),
                "lng": dec("7.408900"),
                "summary": "Thermal signatures, movement reports, and route indicators suggest a live staging area near the forest boundary.",
                "minutes_ago": 16,
            },
            {
                "title": "Kidnapping threat on Kaduna bypass",
                "type": IncidentType.KIDNAPPING,
                "pattern": patterns["Kaduna staging pattern"],
                "signal": "Possible kidnapping setup near Kaduna bypass",
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.HIGH,
                "status": IncidentStatus.OPEN,
                "location": "Kaduna Bypass Segment",
                "lat": dec("10.488900"),
                "lng": dec("7.394700"),
                "summary": "Pursuit-style movement and low-coverage positioning indicate elevated kidnapping risk on the bypass route.",
                "minutes_ago": 24,
            },
            {
                "title": "Abuja southbound anomaly watch",
                "type": IncidentType.THREAT_ACTIVITY,
                "pattern": None,
                "signal": "Abnormal sighting on Abuja southbound approach",
                "confidence": ConfidenceLevel.EMERGING,
                "severity": SeverityLevel.MEDIUM,
                "status": IncidentStatus.MONITORING,
                "location": "Abuja Southern Approach",
                "lat": dec("8.914100"),
                "lng": dec("7.455900"),
                "summary": "Intermittent anomaly reports around the approach corridor remain under analyst review.",
                "minutes_ago": 42,
            },
            {
                "title": "Localized flood hazard on Third Mainland feeder",
                "type": IncidentType.FLOOD,
                "pattern": None,
                "signal": "Flooded low-visibility segment near Third Mainland feeder",
                "confidence": ConfidenceLevel.CORROBORATED,
                "severity": SeverityLevel.MEDIUM,
                "status": IncidentStatus.OPEN,
                "location": "Third Mainland Feeder, Lagos",
                "lat": dec("6.507400"),
                "lng": dec("3.392700"),
                "summary": "Water accumulation and traffic bunching are increasing route vulnerability for commuters.",
                "minutes_ago": 58,
            },
        ]

        incidents = []
        for spec in specs:
            incident, _ = Incident.objects.update_or_create(
                title=spec["title"],
                defaults={
                    "incident_type": spec["type"],
                    "pattern": spec["pattern"],
                    "primary_signal": signals_by_title[spec["signal"]],
                    "confidence": spec["confidence"],
                    "severity": spec["severity"],
                    "status": spec["status"],
                    "location_name": spec["location"],
                    "latitude": spec["lat"],
                    "longitude": spec["lng"],
                    "started_at": now - timedelta(minutes=spec["minutes_ago"] + 12),
                    "summary": spec["summary"],
                    "metadata": DEMO_FLAG,
                },
            )
            Incident.objects.filter(pk=incident.pk).update(
                detected_at=now - timedelta(minutes=spec["minutes_ago"]),
                created_at=now - timedelta(minutes=spec["minutes_ago"]),
                updated_at=now - timedelta(minutes=max(1, spec["minutes_ago"] - 2)),
            )
            incidents.append(incident)
        return incidents

    def _ensure_risk_snapshots(self, watch_zones, patterns, incidents, now):
        incident_by_title = {incident.title: incident for incident in incidents}
        snapshots = [
            {
                "zone": watch_zones["Lekki Peninsula"],
                "pattern": patterns["Lekki commuter threat escalation"],
                "incident": incident_by_title["Armed robbery cluster near Lekki toll corridor"],
                "risk_level": RiskLevel.HIGH,
                "risk_score": Decimal("78.50"),
                "rationale": "Robbery cluster and movement pattern align with peak commuter vulnerability.",
            },
            {
                "zone": watch_zones["Abuja Southern Approach"],
                "pattern": None,
                "incident": incident_by_title["Abuja southbound anomaly watch"],
                "risk_level": RiskLevel.MEDIUM,
                "risk_score": Decimal("64.20"),
                "rationale": "Anomaly reports remain unconfirmed but persistent.",
            },
            {
                "zone": watch_zones["Kaduna Forest Edge"],
                "pattern": patterns["Kaduna staging pattern"],
                "incident": incident_by_title["Kaduna forest edge staging activity"],
                "risk_level": RiskLevel.CRITICAL,
                "risk_score": Decimal("91.40"),
                "rationale": "High confidence staging pattern with fresh corroborating indicators.",
            },
        ]

        for snapshot in snapshots:
            RiskSnapshot.objects.update_or_create(
                watch_zone=snapshot["zone"],
                incident=snapshot["incident"],
                defaults={
                    "pattern": snapshot["pattern"],
                    "risk_level": snapshot["risk_level"],
                    "risk_score": snapshot["risk_score"],
                    "rationale": snapshot["rationale"],
                    "factors": DEMO_FLAG,
                },
            )

    def _ensure_alerts(self, rules, watch_zones, geofences, clusters, patterns, incidents, now):
        incident_by_title = {incident.title: incident for incident in incidents}
        specs = [
            {
                "title": "Critical robbery escalation on Lekki corridor",
                "message": "Fresh critical incident detected near the commuter corridor. Analysts should verify route disruption and deploy response guidance.",
                "severity": SeverityLevel.CRITICAL,
                "watch_zone": watch_zones["Lekki Peninsula"],
                "geofence": geofences["Lekki-Epe Expressway Corridor"],
                "cluster": clusters["Lekki night movement cluster"],
                "pattern": patterns["Lekki commuter threat escalation"],
                "incident": incident_by_title["Armed robbery cluster near Lekki toll corridor"],
                "rule": rules["High severity corroborated incident"],
                "minutes_ago": 8,
            },
            {
                "title": "Forest edge staging alert",
                "message": "High confidence staging activity remains active near Kaduna forest ingress. Monitor route closures and nearby settlements.",
                "severity": SeverityLevel.CRITICAL,
                "watch_zone": watch_zones["Kaduna Forest Edge"],
                "geofence": None,
                "cluster": clusters["Kaduna forest ingress cluster"],
                "pattern": patterns["Kaduna staging pattern"],
                "incident": incident_by_title["Kaduna forest edge staging activity"],
                "rule": rules["High severity corroborated incident"],
                "minutes_ago": 13,
            },
            {
                "title": "Abuja southbound anomaly watch",
                "message": "Emerging anomaly reports continue near the southern approach. Maintain analyst monitoring and collect corroboration.",
                "severity": SeverityLevel.MEDIUM,
                "watch_zone": watch_zones["Abuja Southern Approach"],
                "geofence": geofences["Abuja City Gate Perimeter"],
                "cluster": None,
                "pattern": None,
                "incident": incident_by_title["Abuja southbound anomaly watch"],
                "rule": rules["Escalating corridor activity"],
                "minutes_ago": 36,
            },
        ]

        alerts = []
        for spec in specs:
            alert, _ = Alert.objects.update_or_create(
                title=spec["title"],
                defaults={
                    "rule": spec["rule"],
                    "watch_zone": spec["watch_zone"],
                    "geofence": spec["geofence"],
                    "cluster": spec["cluster"],
                    "pattern": spec["pattern"],
                    "incident": spec["incident"],
                    "severity": spec["severity"],
                    "status": "open",
                    "message": spec["message"],
                    "metadata": DEMO_FLAG,
                },
            )
            Alert.objects.filter(pk=alert.pk).update(
                triggered_at=now - timedelta(minutes=spec["minutes_ago"]),
            )
            alerts.append(alert)
        return alerts
