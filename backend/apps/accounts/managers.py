from django.contrib.auth.base_user import BaseUserManager

#유저 객체를 만드는 방법을 정의한 클래스
class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, nickname, password=None, **extra_fields):
        if not nickname:
            raise ValueError("nickname is required")

        user = self.model(nickname=nickname, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, nickname, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(nickname, password, **extra_fields)
