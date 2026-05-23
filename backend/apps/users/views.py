from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model, logout
from rest_framework import generics, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit_logs.services import record_audit_event

from .models import SourceProfile, UserProfile, UserRole
from .permissions import IsAnalystOrAdmin
from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    SourceProfileSerializer,
    UserProfileSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        record_audit_event(
            "auth.register",
            actor=user,
            request=request,
            description=f"User '{user.username}' registered.",
        )
        return Response(
            {
                "token": token.key,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token, _ = Token.objects.get_or_create(user=user)
        record_audit_event(
            "auth.login",
            actor=user,
            request=request,
            description=f"User '{user.username}' logged in.",
        )
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        record_audit_event(
            "auth.logout",
            actor=request.user,
            request=request,
            description=f"User '{request.user.username}' logged out.",
        )
        Token.objects.filter(user=request.user).delete()
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ApplyCommunityReporterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={"role": UserRole.REGULAR_USER},
        )

        if profile.role != UserRole.REGULAR_USER:
            return Response(
                {
                    "detail": "User already has a non-regular role.",
                    "user": UserSerializer(request.user).data,
                },
                status=status.HTTP_200_OK,
            )

        if not profile.is_active_operator:
            return Response(
                {"detail": "Only active users can apply for community reporter access."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.role = UserRole.COMMUNITY_REPORTER
        profile.save(update_fields=["role", "updated_at"])

        record_audit_event(
            "auth.apply_community_reporter",
            actor=request.user,
            request=request,
            description=f"User '{request.user.username}' upgraded to community reporter.",
        )

        return Response(
            {
                "detail": "Application approved. You are now a community reporter.",
                "user": UserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = User.objects.select_related("profile")


class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = UserProfile.objects.select_related("user")


class SourceProfileViewSet(viewsets.ModelViewSet):
    serializer_class = SourceProfileSerializer
    permission_classes = [IsAnalystOrAdmin]
    queryset = SourceProfile.objects.select_related("user")
