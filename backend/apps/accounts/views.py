from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import LoginSerializer, SignupSerializer


@api_view(["GET"])
def index(_request):
    users = User.objects.values("id")
    return Response({"users": list(users)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({"id": user.id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()
    except Exception:
        return Response(
            {"detail": "유효하지 않은 refresh 토큰입니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"message": "logout success"})


@api_view(["POST"])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    return Response(
        {
            "message": "signup success",
            "user": {"id": user.id},
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

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "message": "login success",
            "user": {"id": user.id},
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
    )