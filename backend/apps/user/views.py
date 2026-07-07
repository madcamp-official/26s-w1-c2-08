from django.contrib.auth.hashers import check_password
from rest_framework import status, permissions, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from apps.accounts.models import User
from .models import Follow
from .serializers import FollowSerializer, FollowerListSerializer, FollowingListSerializer, UsernameChangeSerializer


@api_view(["GET"])
def user_profile(_request, user_id=None):
    if user_id is None:
        users = User.objects.values("id", "username")
        return Response({"users": list(users)})

    user = User.objects.filter(id=user_id).values("id", "username").first()

    if user is None:
        return Response(
            {"detail": "해당 user가 데이터베이스에 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(user)

@api_view(["GET"])
@permission_classes([AllowAny])
def user_list(request):
    users = User.objects.values("id", "username")

    if request.user.is_authenticated:
        users = users.exclude(id=request.user.id)

    return Response({"users": list(users)})

class FollowUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        following_user = get_object_or_404(User, id=user_id)
        follower_user = request.user

        if follower_user.id == following_user.id:
            return Response(
                {"detail": "자기 자신은 팔로우할 수 없습니다."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        follow, created = Follow.objects.get_or_create(
            follower=follower_user,
            following=following_user,
        )

        if not created:
            return Response(
                {"detail": "이미 팔로우하고 있습니다."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {"detail": "팔로우했습니다."},
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, user_id):
        following_user = get_object_or_404(User, id=user_id)
        follower_user = request.user

        deleted_count, _ = Follow.objects.filter(
            follower=follower_user,
            following=following_user,
        ).delete()

        if deleted_count == 0:
            return Response(
                {"detail": "팔로우 관계가 존재하지 않습니다."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
    
class FollowerListView(generics.ListAPIView):
    """특정 user_id를 팔로우하는 사람들의 목록 (팔로워)"""
    serializer_class = FollowerListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]
        get_object_or_404(User, id=user_id)  # 존재하지 않는 유저면 404
        return Follow.objects.filter(following_id=user_id).select_related("follower")


class FollowingListView(generics.ListAPIView):
    """특정 user_id가 팔로우하는 사람들의 목록 (팔로잉)"""
    serializer_class = FollowingListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]
        get_object_or_404(User, id=user_id)
        return Follow.objects.filter(follower_id=user_id).select_related("following")

class UsernameChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)

        if request.user.id != target_user.id:
            return Response(
                {"detail": "본인의 username만 변경할 수 있습니다."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = UsernameChangeSerializer(
            target_user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "id": target_user.id,
                "username": target_user.username,
                "detail": "username이 변경되었습니다.",
            },
            status=status.HTTP_200_OK,
        )