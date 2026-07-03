from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Item, ItemReaction


class ItemRankingTests(APITestCase):
    def test_ranking_orders_items_by_recommend_minus_disrecommend_score(self):
        Item.objects.create(
            name="보통템",
            category=Item.Category.LIVING,
            recommend_count=5,
            disrecommend_count=2,
        )
        Item.objects.create(
            name="강력추천템",
            category=Item.Category.ELECTRONICS,
            recommend_count=4,
            disrecommend_count=0,
        )
        Item.objects.create(
            name="호불호템",
            category=Item.Category.FASHION,
            recommend_count=8,
            disrecommend_count=4,
        )

        response = self.client.get("/api/items/ranking/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["name"] for item in response.data["results"]],
            ["호불호템", "강력추천템", "보통템"],
        )
        self.assertEqual(
            [item["rankingScore"] for item in response.data["results"]],
            [4, 4, 3],
        )

    def test_ranking_can_be_filtered_by_category(self):
        Item.objects.create(
            name="운동화",
            category=Item.Category.FASHION,
            recommend_count=9,
        )
        Item.objects.create(
            name="무선 이어폰",
            category=Item.Category.ELECTRONICS,
            recommend_count=20,
        )

        response = self.client.get(
            f"/api/items/ranking/?category={Item.Category.FASHION}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["category"], Item.Category.FASHION)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "운동화")
        self.assertEqual(
            response.data["results"][0]["categoryLabel"],
            "의류/패션",
        )

    def test_categories_endpoint_returns_item_category_options(self):
        response = self.client.get("/api/items/categories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0], {"value": "all", "label": "전체"})
        self.assertIn(
            {"value": Item.Category.ELECTRONICS, "label": "전자제품"},
            response.data["results"],
        )

    def test_reaction_endpoint_creates_changes_and_cancels_user_reaction(self):
        user = User.objects.create_user(username="tester", password="password123")
        item = Item.objects.create(name="테스트 아이템")
        self.client.force_authenticate(user=user)

        response = self.client.post(
            f"/api/items/{item.id}/reaction/",
            {"reaction": ItemReaction.Reaction.RECOMMEND},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["recommendCount"], 1)
        self.assertEqual(response.data["disrecommendCount"], 0)
        self.assertEqual(response.data["rankingScore"], 1)
        self.assertEqual(response.data["userReaction"], ItemReaction.Reaction.RECOMMEND)

        response = self.client.post(
            f"/api/items/{item.id}/reaction/",
            {"reaction": ItemReaction.Reaction.DISRECOMMEND},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["recommendCount"], 0)
        self.assertEqual(response.data["disrecommendCount"], 1)
        self.assertEqual(response.data["rankingScore"], -1)
        self.assertEqual(
            response.data["userReaction"],
            ItemReaction.Reaction.DISRECOMMEND,
        )

        response = self.client.post(
            f"/api/items/{item.id}/reaction/",
            {"reaction": ItemReaction.Reaction.DISRECOMMEND},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["recommendCount"], 0)
        self.assertEqual(response.data["disrecommendCount"], 0)
        self.assertEqual(response.data["rankingScore"], 0)
        self.assertIsNone(response.data["userReaction"])
        self.assertFalse(ItemReaction.objects.filter(item=item, user=user).exists())
