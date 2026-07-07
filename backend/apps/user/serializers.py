from rest_framework import serializers
from .models import Follow

from apps.accounts.models import User

class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = ["id", "follower", "following", "created_at"]
        read_only_fields = ["id", "follower", "created_at"]

class FollowUserBriefSerializer(serializers.ModelSerializer):
    """팔로워/팔로잉 목록에 표시할 유저 요약 정보"""

    class Meta:
        model = User
        fields = ["id", "username"]


class FollowerListSerializer(serializers.ModelSerializer):
    """나를 팔로우하는 사람 목록 -> follower 유저 정보를 보여줌"""
    user = FollowUserBriefSerializer(source="follower")
    created_at = serializers.DateTimeField()

    class Meta:
        model = Follow
        fields = ["user", "created_at"]


class FollowingListSerializer(serializers.ModelSerializer):
    """내가 팔로우하는 사람 목록 -> following 유저 정보를 보여줌"""
    user = FollowUserBriefSerializer(source="following")
    created_at = serializers.DateTimeField()

    class Meta:
        model = Follow
        fields = ["user", "created_at"]

class UsernameChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username"]

    def validate_username(self, value):
        qs = User.objects.filter(username=value)

        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("이미 사용 중인 username입니다.")

        return value