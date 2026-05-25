from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.alerts.views import AlertRuleViewSet, AlertViewSet
from apps.audit_logs.views import AuditEventViewSet
from apps.geofences.views import GeofenceViewSet
from apps.incidents.views import IncidentViewSet, PatternViewSet, SignalClusterViewSet
from apps.media_assets.views import MediaAssetViewSet, PatrolUploadViewSet
from apps.risk.views import RiskForecastViewSet, RiskSnapshotViewSet, WatchZoneViewSet
from apps.signals.views import (
    SignalAnalyticsViewSet,
    SignalEvidenceViewSet,
    SignalIngestionJobViewSet,
    SignalViewSet,
)
from apps.users.views import (
    ApplyCommunityReporterView,
    CurrentUserView,
    LoginView,
    LogoutView,
    RegisterView,
    SourceProfileViewSet,
    UserProfileViewSet,
    UserViewSet,
)
from config.docs import ApiDocsSummaryView, schema_view
from config.operational import DashboardSummaryView, HealthCheckView
from config.public_views import PublicSafetySummaryView

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("user-profiles", UserProfileViewSet, basename="user-profile")
router.register("source-profiles", SourceProfileViewSet, basename="source-profile")
router.register("audit-events", AuditEventViewSet, basename="audit-event")
router.register("signals", SignalViewSet, basename="signal")
router.register("signal-evidence", SignalEvidenceViewSet, basename="signal-evidence")
router.register("signal-ingestion-jobs", SignalIngestionJobViewSet, basename="signal-ingestion-job")
router.register("signal-analytics", SignalAnalyticsViewSet, basename="signal-analytics")
router.register("signal-clusters", SignalClusterViewSet, basename="signal-cluster")
router.register("patterns", PatternViewSet, basename="pattern")
router.register("incidents", IncidentViewSet, basename="incident")
router.register("watch-zones", WatchZoneViewSet, basename="watch-zone")
router.register("risk-snapshots", RiskSnapshotViewSet, basename="risk-snapshot")
router.register("risk-forecasts", RiskForecastViewSet, basename="risk-forecast")
router.register("geofences", GeofenceViewSet, basename="geofence")
router.register("patrol-uploads", PatrolUploadViewSet, basename="patrol-upload")
router.register("media-assets", MediaAssetViewSet, basename="media-asset")
router.register("alerts", AlertViewSet, basename="alert")
router.register("alert-rules", AlertRuleViewSet, basename="alert-rule")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="api-health"),
    path("schema/", schema_view, name="api-schema"),
    path("docs/summary/", ApiDocsSummaryView.as_view(), name="api-docs-summary"),
    path("public/safety-summary/", PublicSafetySummaryView.as_view(), name="public-safety-summary"),
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path(
        "auth/apply-community-reporter/",
        ApplyCommunityReporterView.as_view(),
        name="auth-apply-community-reporter",
    ),
    *router.urls,
]
