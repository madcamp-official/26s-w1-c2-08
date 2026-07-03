from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from .models import User


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "password"]

    def validate_id(self, value):
        if User.objects.filter(id=value).exists():
            raise serializers.ValidationError("이미 존재하는 id입니다.")
        return value

    def create(self, validated_data):
        validated_data["password"] = make_password(validated_data["password"])
        return User.objects.create(**validated_data)


class LoginSerializer(serializers.Serializer):
    id = serializers.CharField()
    password = serializers.CharField(write_only=True)
