from random import random

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from faker import Faker

from apps.user.models import Follow

User = get_user_model()
fake = Faker("ko_KR")

class Command(BaseCommand):
    help = "더미 User 및 Follow 생성"

    def handle(self, *args, **kwargs):
        # Follow.objects.all().delete()
        # User.objects.filter(is_superuser=False).delete()

        self.stdout.write("User 생성 중...")

        users = []

        for i in range(1000):
            username = f"{fake.user_name()}{i}"

            user = User.objects.create_user(
                username=username,
                password="12345678",
            )
            users.append(user)

        self.stdout.write(
            self.style.SUCCESS("User 생성 완료!")
        )

        self.stdout.write("Follow 생성 중...")

        for follower in users:
            for following in users:
                # 자기 자신은 팔로우 불가
                if follower == following:
                    continue

                # 기본 확률
                probability = 0.08

                # 앞의 5명은 인기 유저로 설정
                if following.id <= 5:
                    probability = 0.45

                if random() < probability:
                    Follow.objects.get_or_create(
                        follower=follower,
                        following=following,
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"{Follow.objects.count()}개의 Follow 생성 완료!"
            )
        )