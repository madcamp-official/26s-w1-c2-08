from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager

class User(AbstractBaseUser, PermissionsMixin):
    id = models.AutoField(primary_key=True)  # 숫자 자동증가 PK
    username = models.CharField(max_length=30, unique=True)  # 로그인/식별용, 중복 불가

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "username"

    def __str__(self):
        return self.username