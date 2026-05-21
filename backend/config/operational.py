from django.db.models import Count
from django.db.models.functions import TruncDate
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alerts.models import Alert
from apps.incidents.models import Incident, Pattern, SignalCluster
from apps.risk.models import WatchZone
from apps.signals.models import Signal


class HealthCheckView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "aegismap-backend"})


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recent_signal_counts = (
            Signal.objects.annotate(day=TruncDate("received_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("-day")[:7]
        )
        return Response(
            {
                "totals": {
                    "signals": Signal.objects.count(),
                    "clusters": SignalCluster.objects.count(),
                    "patterns": Pattern.objects.count(),
                    "incidents": Incident.objects.count(),
                    "watch_zones": WatchZone.objects.count(),
                    "alerts": Alert.objects.count(),
                    "open_alerts": Alert.objects.filter(status__in=["open", "acknowledged"]).count(),
                },
                "risk_breakdown": list(
                    WatchZone.objects.values("current_risk_level")
                    .annotate(count=Count("id"))
                    .order_by("current_risk_level")
                ),
                "recent_signal_counts": [
                    {"day": item["day"], "count": item["count"]} for item in recent_signal_counts
                ],
                "recent_incidents": list(
                    Incident.objects.values(
                        "id",
                        "title",
                        "incident_type",
                        "severity",
                        "status",
                        "detected_at",
                    ).order_by("-detected_at")[:5]
                ),
                "recent_alerts": list(
                    Alert.objects.values(
                        "id",
                        "title",
                        "severity",
                        "status",
                        "triggered_at",
                    ).order_by("-triggered_at")[:5]
                ),
            }
        )
