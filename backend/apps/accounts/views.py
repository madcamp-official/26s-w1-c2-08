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
    users = User.objects.values("id", "username")
    return Response({"users": list(users)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({"id": user.id, "username": user.username})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()

    except KeyError:
        return Response(
            {"detail": "refresh 토큰이 필요합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return Response(
            {"detail": "로그아웃 처리에 실패했습니다."},
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
            "user": {"id": user.id, "username": user.username},
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    password = serializer.validated_data["password"]

    user = User.objects.filter(username=username).first()
    if user is None or not check_password(password, user.password):
        return Response(
            {"detail": "username 또는 password가 올바르지 않습니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "message": "login success",
            "user": {"id": user.id, "username": user.username},
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
    )
