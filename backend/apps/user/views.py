from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.models import User

@api_view(["GET"])
def user_profile(_request, username=None):
    if username is None:
        users = User.objects.values("id", "username")
        return Response({"users": list(users)})

    user = User.objects.filter(username=username).values("id", "username").first()

    if user is None:
        return Response(
            {"detail": "해당 user가 데이터베이스에 없습니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(user)