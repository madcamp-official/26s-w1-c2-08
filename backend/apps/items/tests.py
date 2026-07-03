from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Item, ItemReaction


class ItemApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="tester",
            password="secret1234",
        )
        self.other_user = get_user_model().objects.create_user(
            username="tester2",
            password="secret1234",
        )
        self.item = Item.objects.create(
            name="라벤더 세라마이드 수분크림",
            category=Item.Category.BEAUTY,
            image_url="https://example.com/item.jpg",
            price=28000,
            shop_or_brand_name="MORU BEAUTY",
            original_url="https://shop.example.com/products/lavender-cream",
            created_by=self.user,
        )
        ItemReaction.objects.create(
            item=self.item,
            user=self.user,
            reaction=ItemReaction.Reaction.RECOMMEND,
        )
        ItemReaction.objects.create(
            item=self.item,
            user=self.other_user,
            reaction=ItemReaction.Reaction.NOT_RECOMMEND,
        )

    def test_list_items(self):
        response = self.client.get(reverse("items-list-create"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["name"], self.item.name)

    def test_create_item(self):
        payload = {
            "name": "세라마이드 진정 크림",
            "image_url": "https://example.com/new-item.jpg",
            "price": 26500,
            "shop_or_brand_name": "MORU",
            "original_url": "https://shop.example.com/products/ceramide-cream",
            "created_by": self.user.id,
        }

        response = self.client.post(reverse("items-list-create"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Item.objects.count(), 2)
        self.assertEqual(Item.objects.get(original_url=payload["original_url"]).name, payload["name"])
        self.assertEqual(response.data["recommend_count"], 0)
        self.assertEqual(response.data["not_recommend_count"], 0)

    def test_update_item(self):
        response = self.client.patch(
            reverse("items-detail", args=[self.item.id]),
            {"price": 30000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.price, 30000)
        self.assertEqual(self.item.recommend_count, 1)
        self.assertEqual(self.item.not_recommend_count, 1)

    def test_delete_item(self):
        response = self.client.delete(reverse("items-detail", args=[self.item.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Item.objects.filter(id=self.item.id).exists())

    def test_filter_items_by_name(self):
        response = self.client.get(reverse("items-list-create"), {"name": "라벤더"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_item_reactions(self):
        response = self.client.get(reverse("item-reactions", args=[self.item.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_item_reaction(self):
        third_user = get_user_model().objects.create_user(
            username="tester3",
            password="secret1234",
        )
        response = self.client.post(
            reverse("item-reactions", args=[self.item.id]),
            {"user_id": third_user.id, "reaction": "recommend"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.recommend_count, 2)
        self.assertEqual(self.item.not_recommend_count, 1)

    def test_update_item_reaction_by_user(self):
        response = self.client.put(
            reverse("item-reaction-detail", args=[self.item.id, self.other_user.id]),
            {"reaction": "recommend"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.recommend_count, 2)
        self.assertEqual(self.item.not_recommend_count, 0)

    def test_delete_item_reaction_by_user(self):
        response = self.client.delete(
            reverse("item-reaction-detail", args=[self.item.id, self.other_user.id]),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.item.refresh_from_db()
        self.assertEqual(self.item.recommend_count, 1)
        self.assertEqual(self.item.not_recommend_count, 0)

    def test_ranking_endpoint(self):
        Item.objects.create(
            name="무선 이어폰",
            category=Item.Category.ELECTRONICS,
            image_url="https://example.com/earbuds.jpg",
            price=129000,
            shop_or_brand_name="SOUND LAB",
            original_url="https://shop.example.com/products/earbuds",
            recommend_count=4,
            not_recommend_count=0,
        )

        response = self.client.get(reverse("item-ranking"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["name"], "무선 이어폰")
        self.assertEqual(response.data["results"][0]["rankingScore"], 4)

    def test_categories_endpoint(self):
        response = self.client.get(reverse("item-categories"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0], {"value": "all", "label": "전체"})
        self.assertIn(
            {"value": Item.Category.ELECTRONICS, "label": "전자제품"},
            response.data["results"],
        )

    def test_toggle_reaction_endpoint(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("item-reaction", args=[self.item.id]),
            {"reaction": "recommend"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["recommendCount"], 0)
        self.assertEqual(response.data["userReaction"], None)

        response = self.client.post(
            reverse("item-reaction", args=[self.item.id]),
            {"reaction": "disrecommend"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["disrecommendCount"], 2)
        self.assertEqual(response.data["userReaction"], "not_recommend")
