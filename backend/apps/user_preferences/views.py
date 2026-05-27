from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserPreference
from .serializers import UserPreferenceSerializer


class UserPreferenceViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get", "put"], url_path="me")
    def me(self, request):
        pref, created = UserPreference.objects.get_or_create(user=request.user)
        if request.method == "GET":
            return Response(UserPreferenceSerializer(pref).data)
        # PUT
        serializer = UserPreferenceSerializer(pref, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
