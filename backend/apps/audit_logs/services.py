from django.http import HttpRequest

from .models import AuditEvent, AuditSeverity


def record_audit_event(
    event_type: str,
    *,
    actor=None,
    severity: str = AuditSeverity.INFO,
    obj=None,
    request: HttpRequest | None = None,
    description: str = "",
    metadata: dict | None = None,
) -> AuditEvent:
    return AuditEvent.objects.create(
        actor=actor,
        severity=severity,
        event_type=event_type,
        object_type=obj.__class__.__name__ if obj is not None else "",
        object_id=str(getattr(obj, "pk", "")) if obj is not None else "",
        request_path=request.path if request is not None else "",
        ip_address=_extract_ip(request),
        description=description,
        metadata=metadata or {},
    )


def _extract_ip(request: HttpRequest | None) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
