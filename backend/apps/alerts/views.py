from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite, IsAnalystOrAdmin
from apps.users.permissions import get_user_role, is_analyst_or_admin
from apps.users.models import UserRole

from .models import Alert, AlertRule
from .serializers import AlertRuleSerializer, AlertSerializer


class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Alert.objects.select_related(
        "rule",
        "watch_zone",
        "geofence",
        "cluster",
        "pattern",
        "incident",
    )

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        state = (self.request.query_params.get("state") or "").strip()

        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)

        if state:
            queryset = queryset.filter(
                Q(metadata__location_state__iexact=state)
                | Q(watch_zone__metadata__location_state__iexact=state)
                | Q(geofence__metadata__location_state__iexact=state)
                | Q(incident__metadata__location_state__iexact=state)
            )

        if not is_analyst_or_admin(self.request.user):
            queryset = queryset.exclude(status__in=["dismissed", "suppressed"])
            queryset = self._filter_for_targeted_delivery(queryset)

        return queryset

    def _filter_for_targeted_delivery(self, queryset):
        profile = getattr(self.request.user, "profile", None)
        metadata = getattr(profile, "metadata", {}) or {}
        watched_areas = {str(item).casefold() for item in metadata.get("watched_areas", []) if item}
        saved_routes = {str(item).casefold() for item in metadata.get("saved_routes", []) if item}
        region_name = (getattr(profile, "region_name", "") or "").casefold()

        area_filters = Q()
        if watched_areas:
            for area in watched_areas:
                area_filters |= Q(metadata__location_state__iexact=area) | Q(metadata__targeting__watched_areas__icontains=area)
        if region_name:
            area_filters |= Q(metadata__location_state__iexact=region_name) | Q(metadata__targeting__watched_areas__icontains=region_name)

        route_filters = Q()
        if saved_routes:
            for route in saved_routes:
                route_filters |= Q(metadata__targeting__saved_routes__icontains=route)

        if area_filters or route_filters:
            return queryset.filter(area_filters | route_filters)
        return queryset.none()

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.status = "acknowledged"
        alert.acknowledged_at = timezone.now()
        alert.save(update_fields=["status", "acknowledged_at"])
        record_audit_event(
            "alert.acknowledged",
            actor=request.user,
            obj=alert,
            request=request,
            description=f"Alert '{alert.title}' acknowledged.",
        )
        return Response(self.get_serializer(alert).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.status = "resolved"
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["status", "resolved_at"])
        record_audit_event(
            "alert.resolved",
            actor=request.user,
            obj=alert,
            request=request,
            description=f"Alert '{alert.title}' resolved.",
        )
        return Response(self.get_serializer(alert).data)

    @action(detail=True, methods=["post"])
    def suppress(self, request, pk=None):
        if get_user_role(request.user) != UserRole.ADMIN:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        alert = self.get_object()
        alert.status = "suppressed"
        alert.metadata = {
            **(alert.metadata or {}),
            "suppressed_by": request.user.username,
            "suppressed_at": timezone.now().isoformat(),
            "suppression_reason": request.data.get("reason", ""),
        }
        alert.save(update_fields=["status", "metadata"])
        record_audit_event(
            "alert.suppressed",
            actor=request.user,
            obj=alert,
            request=request,
            description=f"Alert '{alert.title}' suppressed by admin.",
        )
        return Response(self.get_serializer(alert).data)


class AlertRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AlertRuleSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = AlertRule.objects.all()
