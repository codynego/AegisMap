from rest_framework import viewsets

from apps.users.permissions import IsAuthenticatedCreateReadAnalystWrite, is_analyst_or_admin

from .models import MediaAsset, PatrolUpload
from .serializers import MediaAssetSerializer, PatrolUploadSerializer


class PatrolUploadViewSet(viewsets.ModelViewSet):
    serializer_class = PatrolUploadSerializer
    permission_classes = [IsAuthenticatedCreateReadAnalystWrite]
    queryset = PatrolUpload.objects.select_related("uploaded_by", "source_profile")

    def get_queryset(self):
        queryset = self.queryset
        if is_analyst_or_admin(self.request.user):
            return queryset
        return queryset.filter(uploaded_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class MediaAssetViewSet(viewsets.ModelViewSet):
    serializer_class = MediaAssetSerializer
    permission_classes = [IsAuthenticatedCreateReadAnalystWrite]
    queryset = MediaAsset.objects.select_related(
        "uploaded_by",
        "source_profile",
        "patrol_upload",
    )

    def get_queryset(self):
        queryset = self.queryset
        if is_analyst_or_admin(self.request.user):
            return queryset
        return queryset.filter(uploaded_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
