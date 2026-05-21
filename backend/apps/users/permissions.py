from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import UserRole


def get_user_role(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile = getattr(user, "profile", None)
    return getattr(profile, "role", None)


def is_analyst_or_admin(user) -> bool:
    return get_user_role(user) in {UserRole.ANALYST, UserRole.ADMIN}


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
