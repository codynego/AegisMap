from urllib.error import URLError

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import (
    IsAnalystOrAdmin,
    IsAuthenticatedCreateReadAnalystWrite,
    AllowCreateAuthenticatedReadAnalystWrite,
    IsAuthenticatedReadAnalystWrite,
)

from .models import RiskSnapshot, WatchZone
from .serializers import (
    RiskForecastSerializer,
    RiskSnapshotSerializer,
    WatchZoneSerializer,
    WeatherIntelligenceRequestSerializer,
)
from .services import _haversine, build_risk_forecasts, build_weather_intelligence, evaluate_watch_zone


class WatchZoneViewSet(viewsets.ModelViewSet):
    serializer_class = WatchZoneSerializer
    permission_classes = [AllowCreateAuthenticatedReadAnalystWrite]
    queryset = WatchZone.objects.prefetch_related("snapshots")

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        risk_level = self.request.query_params.get("risk_level")

        if status_value:
            queryset = queryset.filter(status=status_value)
        if risk_level:
            queryset = queryset.filter(current_risk_level=risk_level)

        return queryset

    @action(detail=True, methods=["post"])
    def evaluate(self, request, pk=None):
        watch_zone = self.get_object()
        evaluate_watch_zone(watch_zone)
        watch_zone.refresh_from_db()
        record_audit_event(
            "watch_zone.evaluated",
            actor=request.user,
            obj=watch_zone,
            request=request,
            description=f"Watch zone '{watch_zone.name}' evaluated.",
        )
        return Response(self.get_serializer(watch_zone).data)


class RiskSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = RiskSnapshotSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = RiskSnapshot.objects.select_related(
        "watch_zone",
        "pattern",
        "incident",
    )

    def get_queryset(self):
        queryset = self.queryset
        watch_zone_id = self.request.query_params.get("watch_zone")
        if watch_zone_id:
            queryset = queryset.filter(watch_zone_id=watch_zone_id)
        return queryset


class RiskForecastViewSet(viewsets.ViewSet):
    permission_classes = [IsAnalystOrAdmin]

    def list(self, request):
        state = request.query_params.get("state")
        forecasts = build_risk_forecasts(state=state)
        category = request.query_params.get("category")
        min_confidence = request.query_params.get("min_confidence")
        limit = request.query_params.get("limit")
        latitude = request.query_params.get("latitude")
        longitude = request.query_params.get("longitude")
        radius_km = request.query_params.get("radius_km")

        if category:
            forecasts = [forecast for forecast in forecasts if forecast["category"] == category]
        if min_confidence:
            try:
                threshold = int(min_confidence)
                forecasts = [forecast for forecast in forecasts if forecast["confidence"] >= threshold]
            except ValueError:
                pass
        if latitude and longitude:
            try:
                center_latitude = float(latitude)
                center_longitude = float(longitude)
                radius = max(1.0, float(radius_km or 50))
                forecasts = [
                    forecast
                    for forecast in forecasts
                    if _haversine(
                        center_latitude,
                        center_longitude,
                        float(forecast["latitude"]),
                        float(forecast["longitude"]),
                    )
                    <= radius
                ]
            except ValueError:
                pass
        if limit:
            try:
                forecasts = forecasts[: max(1, int(limit))]
            except ValueError:
                pass

        return Response(RiskForecastSerializer(forecasts, many=True).data)


class WeatherIntelligenceView(APIView):
    permission_classes = [IsAuthenticatedCreateReadAnalystWrite]

    def post(self, request):
        serializer = WeatherIntelligenceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            intelligence = build_weather_intelligence(
                points=payload.get("points", []),
                watch_zones=payload.get("watch_zones", []),
                route_path=payload.get("route_path", []),
            )
        except URLError:
            return Response(
                {"detail": "Weather provider is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(intelligence)
