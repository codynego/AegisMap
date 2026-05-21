from rest_framework.routers import DefaultRouter

from apps.alerts.views import AlertRuleViewSet, AlertViewSet
from apps.risk.views import RiskSnapshotViewSet, WatchZoneViewSet
from apps.signals.views import SignalEvidenceViewSet, SignalViewSet

router = DefaultRouter()
router.register("signals", SignalViewSet, basename="signal")
router.register("signal-evidence", SignalEvidenceViewSet, basename="signal-evidence")
router.register("watch-zones", WatchZoneViewSet, basename="watch-zone")
router.register("risk-snapshots", RiskSnapshotViewSet, basename="risk-snapshot")
router.register("alerts", AlertViewSet, basename="alert")
router.register("alert-rules", AlertRuleViewSet, basename="alert-rule")

urlpatterns = router.urls
