from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import UserRole

PUBLIC_ROLES = {UserRole.REGULAR_USER, UserRole.COMMUNITY_REPORTER, UserRole.TRUSTED_VERIFIER}
INTERNAL_ROLES = {UserRole.ANALYST, UserRole.ADMIN}


def get_user_role(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile = getattr(user, "profile", None)
    return getattr(profile, "role", None)


def is_analyst_or_admin(user) -> bool:
    return get_user_role(user) in {UserRole.ANALYST, UserRole.ADMIN}


def is_internal_user(user) -> bool:
    return get_user_role(user) in INTERNAL_ROLES


def is_trusted_reporter(user) -> bool:
    return get_user_role(user) == UserRole.TRUSTED_VERIFIER


def is_public_contributor(user) -> bool:
    return get_user_role(user) in PUBLIC_ROLES


def can_view_public_reports(user) -> bool:
    return bool(getattr(user, "is_authenticated", False)) and (is_public_contributor(user) or is_internal_user(user))


def can_submit_public_verification(user) -> bool:
    return bool(getattr(user, "is_authenticated", False)) and (is_public_contributor(user) or is_internal_user(user))


class IsAnalystOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_analyst_or_admin(request.user)


class IsAuthenticatedReadAnalystWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_analyst_or_admin(request.user)


class AllowCreateAuthenticatedReadAnalystWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_analyst_or_admin(request.user)


class IsAuthenticatedCreateReadAnalystWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        if request.method == "POST":
            return bool(request.user and request.user.is_authenticated)
        return is_analyst_or_admin(request.user)
