from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from faker import Faker

User = get_user_model()
fake = Faker("ko_KR")


class Command(BaseCommand):
    help = "더미 User 생성"

    def handle(self, *args, **kwargs):
        self.stdout.write("User 생성 중...")

        for i in range(100):
            username = f"{fake.user_name()}{i}"

            User.objects.create_user(
                username=username,
                password="12345678",
            )

        self.stdout.write(
            self.style.SUCCESS("100명의 User 생성 완료!")
        )