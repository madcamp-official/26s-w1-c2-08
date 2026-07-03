from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def api_root(_request):
    return Response(
        {
            "service": "backend",
            "status": "ok",
            "endpoints": {
                "health": "/api/health/",
                "accounts": "/api/accounts/",
                "items": "/api/items/",
                "reviews": "/api/reviews/",
                "recommendations": "/api/recommendations/",
            },
        }
    )


@api_view(["GET"])
def health_check(_request):
    return Response(
        {
            "status": "ok",
            "message": "Backend server is running.",
        }
    )

