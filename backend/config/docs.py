from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.schemas import get_schema_view
from rest_framework.views import APIView


schema_view = get_schema_view(
    title="AegisMap API",
    description="Geospatial OSINT, risk intelligence, and operator workflow API.",
    version="1.0.0",
    public=True,
    permission_classes=[AllowAny],
)


class ApiDocsSummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "name": "AegisMap API",
                "version": "1.0.0",
                "auth": {
                    "register": "/api/auth/register/",
                    "login": "/api/auth/login/",
                    "logout": "/api/auth/logout/",
                    "me": "/api/auth/me/",
                },
                "workflow_actions": {
                    "signals": ["reassess", "dismiss"],
                    "patterns": ["promote", "resolve"],
                    "incidents": ["monitor", "resolve"],
                    "watch_zones": ["evaluate"],
                    "alerts": ["acknowledge", "resolve"],
                },
                "schema": "/api/schema/",
            }
        )
