from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from .models import FeatureRequest, FeatureVote
from .serializers import FeatureRequestSerializer, FeatureVoteSerializer


class FeatureRequestViewSet(viewsets.ModelViewSet):
    queryset = FeatureRequest.objects.all().order_by("-created_at")
    serializer_class = FeatureRequestSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=["post"], url_path="vote", permission_classes=[AllowAny])
    def vote(self, request, pk=None):
        feature = get_object_or_404(FeatureRequest, pk=pk)
        # optional: associate with authenticated user
        user = request.user if request.user and request.user.is_authenticated else None
        FeatureVote.objects.create(feature=feature, user=user)
        # increment counter
        feature.votes = FeatureVote.objects.filter(feature=feature).count()
        feature.save(update_fields=["votes"])
        return Response(FeatureRequestSerializer(feature).data, status=status.HTTP_200_OK)
