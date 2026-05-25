from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.services import record_audit_event
from apps.users.permissions import IsAuthenticatedReadAnalystWrite
from apps.users.permissions import is_analyst_or_admin, get_user_role
from apps.users.models import UserRole

from .models import Incident, Pattern, SignalCluster
from .serializers import IncidentSerializer, PatternSerializer, SignalClusterSerializer
from .services import (
    build_incident_verification_summary,
    calculate_incident_visibility_score,
    promote_pattern_to_incident,
    recompute_incident_state,
    should_display_incident_on_map,
)


class SignalClusterViewSet(viewsets.ModelViewSet):
    serializer_class = SignalClusterSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = SignalCluster.objects.annotate(signal_count=Count("signals")).order_by(
        "-updated_at"
    )

    def get_queryset(self):
        queryset = self.queryset
        cluster_type = self.request.query_params.get("cluster_type")
        confidence = self.request.query_params.get("confidence")
        status_value = self.request.query_params.get("status")

        if cluster_type:
            queryset = queryset.filter(cluster_type=cluster_type)
        if confidence:
            queryset = queryset.filter(confidence=confidence)
        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset


class PatternViewSet(viewsets.ModelViewSet):
    serializer_class = PatternSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Pattern.objects.select_related("cluster")

    def get_queryset(self):
        queryset = self.queryset
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        confidence = self.request.query_params.get("confidence")

        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)
        if confidence:
            queryset = queryset.filter(confidence=confidence)

        return queryset

    @action(detail=True, methods=["post"])
    def promote(self, request, pk=None):
        pattern = self.get_object()
        incident = promote_pattern_to_incident(pattern)
        if incident is None:
            return Response(
                {"detail": "Pattern does not yet meet incident promotion criteria."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record_audit_event(
            "pattern.promoted",
            actor=request.user,
            obj=pattern,
            request=request,
            description=f"Pattern '{pattern.name}' promoted to incident.",
            metadata={"incident_id": incident.pk},
        )
        return Response(IncidentSerializer(incident, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        pattern = self.get_object()
        pattern.status = "resolved"
        pattern.last_detected_at = timezone.now()
        pattern.save(update_fields=["status", "last_detected_at", "updated_at"])
        record_audit_event(
            "pattern.resolved",
            actor=request.user,
            obj=pattern,
            request=request,
            description=f"Pattern '{pattern.name}' resolved.",
        )
        return Response(self.get_serializer(pattern).data)


class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = Incident.objects.select_related("pattern", "primary_signal")

    def get_queryset(self):
        queryset = self.queryset
        incident_type = self.request.query_params.get("incident_type")
        status_value = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        confidence = self.request.query_params.get("confidence")
        location = (self.request.query_params.get("location") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()

        if incident_type:
            queryset = queryset.filter(incident_type=incident_type)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if severity:
            queryset = queryset.filter(severity=severity)
        if confidence:
            queryset = queryset.filter(confidence=confidence)
        if location:
            queryset = queryset.filter(
                Q(location_name__icontains=location)
                | Q(metadata__location_state__icontains=location)
                | Q(pattern__geographic_hint__icontains=location)
                | Q(primary_signal__location_name__icontains=location)
                | Q(primary_signal__route_hint__icontains=location)
            )
        if date_from:
            parsed_date_from = parse_date(date_from)
            if parsed_date_from:
                queryset = queryset.filter(detected_at__date__gte=parsed_date_from)
        if date_to:
            parsed_date_to = parse_date(date_to)
            if parsed_date_to:
                queryset = queryset.filter(detected_at__date__lte=parsed_date_to)

        # filter by administrative state (metadata or related objects may store location_state)
        state = (self.request.query_params.get("state") or "").strip()
        if state:
            queryset = queryset.filter(
                Q(metadata__location_state__iexact=state)
                | Q(pattern__metadata__location_state__iexact=state)
                | Q(primary_signal__metadata__location_state__iexact=state)
                | Q(location_name__icontains=state)
            )

        # support verification queue for analysts: when requested, return incidents needing confirmation
        verification_queue = self.request.query_params.get("verification_queue") == "true"
        include_hidden = self.request.query_params.get("include_hidden") == "true" and is_analyst_or_admin(self.request.user)
        if verification_queue and is_analyst_or_admin(self.request.user):
            queryset = queryset.filter(status__in=["unconfirmed", "probable", "verified", "active"])
            user_id = getattr(self.request.user, "id", None)
            if user_id is not None:
                hidden_ids = []
                for incident in queryset:
                    events = (incident.metadata or {}).get("verification_events", [])
                    if any(event.get("user_id") == user_id for event in events if isinstance(event, dict)):
                        hidden_ids.append(incident.pk)
                if hidden_ids:
                    queryset = queryset.exclude(pk__in=hidden_ids)
        elif not is_analyst_or_admin(self.request.user):
            queryset = queryset.filter(status__in=["verified", "active", "resolved"])

        if self.action == "list" and not include_hidden and not is_analyst_or_admin(self.request.user):
            visible_ids = []
            for incident in queryset:
                if should_display_incident_on_map(incident):
                    visible_ids.append(incident.pk)
            queryset = queryset.filter(pk__in=visible_ids)

        return queryset

    @action(detail=True, methods=["post"])
    def monitor(self, request, pk=None):
        incident = self.get_object()
        incident.status = "probable"
        incident.save(update_fields=["status", "updated_at"])
        record_audit_event(
            "incident.monitoring",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' moved to monitoring.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        incident = self.get_object()
        incident.status = "resolved"
        incident.resolved_at = timezone.now()
        incident.save(update_fields=["status", "resolved_at", "updated_at"])
        record_audit_event(
            "incident.resolved",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' resolved.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Admin-only: mark incident as approved/high-confidence."""
        # permit only admins to approve
        if get_user_role(request.user) != UserRole.ADMIN.value:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)

        incident = self.get_object()
        # set high confidence and verified status
        incident.confidence = "high"
        incident.metadata = {
            **incident.metadata,
            "approved_by": request.user.username if request.user and request.user.is_authenticated else None,
            "approved_at": timezone.now().isoformat(),
            "manually_verified_by": request.user.username if request.user and request.user.is_authenticated else None,
            "last_reconfirmed_at": timezone.now().isoformat(),
            "decay_started_at": incident.metadata.get("decay_started_at") or timezone.now().isoformat(),
        }
        recompute_incident_state(incident)
        incident.save(update_fields=["confidence", "status", "metadata", "updated_at"])
        record_audit_event(
            "incident.approved",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' approved by admin.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def submit_verification(self, request, pk=None):
        """Allow analysts/admins to submit a verification vote for an incident.

        Stores a lightweight verification event in incident.metadata.verification_events
        and updates metadata.verification_summary (counts & simple consensus ratio).
        """
        if not is_analyst_or_admin(request.user):
            return Response({"detail": "Analysts only."}, status=status.HTTP_403_FORBIDDEN)

        incident = self.get_object()
        resp = (request.data.get("response") or "").strip().lower()
        if resp not in {"confirm", "deny", "unsure"}:
            return Response({"detail": "Invalid response."}, status=status.HTTP_400_BAD_REQUEST)

        # simple role-based weight
        role = getattr(getattr(request.user, "profile", None), "role", None)
        if role == UserRole.ADMIN:
            weight = 10.0
        elif role == UserRole.ANALYST:
            weight = 8.0
        elif role == UserRole.TRUSTED_VERIFIER:
            weight = 5.0
        else:
            weight = 1.0

        events = incident.metadata.get("verification_events", [])
        # update or append event for this user
        found = False
        for ev in events:
            if ev.get("user_id") == getattr(request.user, "id", None):
                ev.update({
                    "response": resp,
                    "weight": weight,
                    "role": role,
                    "submitted_at": timezone.now().isoformat(),
                })
                found = True
                break
        if not found:
            events.append({
                "user_id": getattr(request.user, "id", None),
                "username": getattr(request.user, "username", None),
                "response": resp,
                "weight": weight,
                "role": role,
                "submitted_at": timezone.now().isoformat(),
            })

        summary = build_incident_verification_summary(events)

        incident.metadata = {
            **incident.metadata,
            "verification_events": events,
            "verification_summary": summary,
        }
        if resp == "confirm":
            incident.metadata["last_reconfirmed_at"] = timezone.now().isoformat()
            incident.metadata["decay_started_at"] = incident.metadata.get("decay_started_at") or timezone.now().isoformat()
        incident.save(update_fields=["metadata", "updated_at"])
        recompute_incident_state(incident)

        record_audit_event(
            "incident.verification_submitted",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Verification '{resp}' submitted for incident '{incident.title}'.",
        )

        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def downgrade(self, request, pk=None):
        if get_user_role(request.user) != UserRole.ADMIN.value:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        incident = self.get_object()
        next_status = (request.data.get("status") or "probable").strip().lower()
        if next_status not in {"unconfirmed", "probable", "verified", "active", "resolved", "archived"}:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        incident.status = next_status
        incident.metadata = {
            **(incident.metadata or {}),
            "downgraded_by": request.user.username,
            "downgraded_at": timezone.now().isoformat(),
            "downgrade_reason": request.data.get("reason", ""),
        }
        incident.save(update_fields=["status", "metadata", "updated_at"])
        record_audit_event(
            "incident.downgraded",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' downgraded to {next_status}.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        if get_user_role(request.user) != UserRole.ADMIN.value:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        incident = self.get_object()
        incident.status = "archived"
        incident.metadata = {
            **(incident.metadata or {}),
            "archived_by": request.user.username,
            "archived_at": timezone.now().isoformat(),
        }
        incident.save(update_fields=["status", "metadata", "updated_at"])
        record_audit_event(
            "incident.archived",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' archived.",
        )
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"])
    def remove_from_map(self, request, pk=None):
        if get_user_role(request.user) != UserRole.ADMIN.value:
            return Response({"detail": "Admins only."}, status=status.HTTP_403_FORBIDDEN)
        incident = self.get_object()
        incident.metadata = {
            **(incident.metadata or {}),
            "hidden_from_map": True,
            "removed_from_map_by": request.user.username,
            "removed_from_map_at": timezone.now().isoformat(),
        }
        incident.save(update_fields=["metadata", "updated_at"])
        record_audit_event(
            "incident.removed_from_map",
            actor=request.user,
            obj=incident,
            request=request,
            description=f"Incident '{incident.title}' removed from map.",
            metadata={"visibility_score": calculate_incident_visibility_score(incident)},
        )
        return Response(self.get_serializer(incident).data)
