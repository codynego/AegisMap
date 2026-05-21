from django.db.models import Count

from apps.incidents.models import Pattern, SignalCluster
from apps.risk.models import WatchZone

from .models import Signal


def build_signal_analytics() -> dict:
    return {
        "signals_by_category": list(
            Signal.objects.values("category").annotate(count=Count("id")).order_by("-count")
        ),
        "signals_by_confidence": list(
            Signal.objects.values("confidence").annotate(count=Count("id")).order_by("-count")
        ),
        "cluster_hotspots": list(
            SignalCluster.objects.values(
                "id",
                "name",
                "confidence",
                "status",
                "centroid_latitude",
                "centroid_longitude",
            )
            .annotate(signal_count=Count("signals"))
            .order_by("-signal_count", "-updated_at")[:10]
        ),
        "pattern_overview": list(
            Pattern.objects.values("status", "severity").annotate(count=Count("id")).order_by("-count")
        ),
        "watch_zone_overview": list(
            WatchZone.objects.values("current_risk_level").annotate(count=Count("id")).order_by("-count")
        ),
    }
