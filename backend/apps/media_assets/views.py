from rest_framework import viewsets

from apps.users.permissions import IsAuthenticatedReadAnalystWrite

from .models import MediaAsset, PatrolUpload
from .serializers import MediaAssetSerializer, PatrolUploadSerializer


class PatrolUploadViewSet(viewsets.ModelViewSet):
    serializer_class = PatrolUploadSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = PatrolUpload.objects.select_related("uploaded_by", "source_profile")

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class MediaAssetViewSet(viewsets.ModelViewSet):
    serializer_class = MediaAssetSerializer
    permission_classes = [IsAuthenticatedReadAnalystWrite]
    queryset = MediaAsset.objects.select_related(
        "uploaded_by",
        "source_profile",
        "patrol_upload",
    )

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
