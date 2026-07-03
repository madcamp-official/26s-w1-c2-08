from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.contrib.auth.hashers import check_password

from .models import User
from .serializers import LoginSerializer, SignupSerializer


@api_view(["GET"])
def index(_request):
    return Response({"service": "accounts", "status": "ready"})


@api_view(["POST"])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    return Response(
        {
            "message": "signup success",
            "user": {
                "id": user.id,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user_id = serializer.validated_data["id"]
    password = serializer.validated_data["password"]

    user = User.objects.filter(id=user_id).first()
    if user is None or not check_password(password, user.password):
        return Response(
            {"detail": "id 또는 password가 올바르지 않습니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "message": "login success",
            "user": {
                "id": user.id,
            },
        }
    )
