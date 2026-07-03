from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.items.models import Item, ItemReaction


class Command(BaseCommand):
    help = "Reset item-related demo data and seed example items with reactions."

    @transaction.atomic
    def handle(self, *args, **options):
        user_model = get_user_model()

        self.stdout.write("Deleting existing item and user data...")
        ItemReaction.objects.all().delete()
        Item.objects.all().delete()
        user_model.objects.exclude(is_superuser=True).delete()

        users = [
            user_model(username="alice", first_name="Alice"),
            user_model(username="bora", first_name="Bora"),
            user_model(username="cody", first_name="Cody"),
            user_model(username="dana", first_name="Dana"),
            user_model(username="eunjin", first_name="Eunjin"),
            user_model(username="felix", first_name="Felix"),
            user_model(username="gayeon", first_name="Gayeon"),
        ]
        for user in users:
            user.set_password("demo1234!")
        user_model.objects.bulk_create(users)

        created_users = list(user_model.objects.filter(username__in=[user.username for user in users]).order_by("id"))
        user_map = {user.username: user for user in created_users}

        items = [
            Item(
                name="라벤더 세라마이드 수분크림 80ml",
                image_url="https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80",
                price=28000,
                shop_or_brand_name="MORU BEAUTY",
                original_url="https://shop.example.com/products/lavender-ceramide-cream",
                created_by=user_map["alice"],
            ),
            Item(
                name="저소음 무선 기계식 키보드",
                image_url="https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80",
                price=119000,
                shop_or_brand_name="TYPELAB",
                original_url="https://shop.example.com/products/type-lab-wireless-keyboard",
                created_by=user_map["bora"],
            ),
            Item(
                name="스테인리스 진공 텀블러 600ml",
                image_url="https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80",
                price=22000,
                shop_or_brand_name="DAYMATE",
                original_url="https://shop.example.com/products/daymate-tumbler-600",
                created_by=user_map["cody"],
            ),
            Item(
                name="목 허리 분리형 메모리폼 쿠션",
                image_url="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
                price=45900,
                shop_or_brand_name="HOMEBALANCE",
                original_url="https://shop.example.com/products/homebalance-memory-cushion",
                created_by=user_map["dana"],
            ),
        ]
        Item.objects.bulk_create(items)

        created_items = list(Item.objects.all().order_by("id"))
        item_map = {item.name: item for item in created_items}

        reactions = [
            ("라벤더 세라마이드 수분크림 80ml", "alice", ItemReaction.Reaction.RECOMMEND),
            ("라벤더 세라마이드 수분크림 80ml", "bora", ItemReaction.Reaction.RECOMMEND),
            ("라벤더 세라마이드 수분크림 80ml", "cody", ItemReaction.Reaction.RECOMMEND),
            ("라벤더 세라마이드 수분크림 80ml", "dana", ItemReaction.Reaction.RECOMMEND),
            ("라벤더 세라마이드 수분크림 80ml", "eunjin", ItemReaction.Reaction.NOT_RECOMMEND),
            ("저소음 무선 기계식 키보드", "alice", ItemReaction.Reaction.RECOMMEND),
            ("저소음 무선 기계식 키보드", "bora", ItemReaction.Reaction.RECOMMEND),
            ("저소음 무선 기계식 키보드", "felix", ItemReaction.Reaction.RECOMMEND),
            ("저소음 무선 기계식 키보드", "gayeon", ItemReaction.Reaction.NOT_RECOMMEND),
            ("스테인리스 진공 텀블러 600ml", "cody", ItemReaction.Reaction.RECOMMEND),
            ("스테인리스 진공 텀블러 600ml", "dana", ItemReaction.Reaction.RECOMMEND),
            ("스테인리스 진공 텀블러 600ml", "eunjin", ItemReaction.Reaction.RECOMMEND),
            ("스테인리스 진공 텀블러 600ml", "felix", ItemReaction.Reaction.NOT_RECOMMEND),
            ("목 허리 분리형 메모리폼 쿠션", "alice", ItemReaction.Reaction.RECOMMEND),
            ("목 허리 분리형 메모리폼 쿠션", "bora", ItemReaction.Reaction.NOT_RECOMMEND),
            ("목 허리 분리형 메모리폼 쿠션", "cody", ItemReaction.Reaction.NOT_RECOMMEND),
        ]

        for item_name, username, reaction_type in reactions:
            ItemReaction.objects.create(
                item=item_map[item_name],
                user=user_map[username],
                reaction=reaction_type,
            )

        for item in created_items:
            item.refresh_from_db()

        self.stdout.write(self.style.SUCCESS("Seeded 4 items and 16 item reactions."))
