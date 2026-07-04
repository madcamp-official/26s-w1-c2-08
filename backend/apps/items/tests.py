import os
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Item, Star
from .vision_service import _build_vision_environment


def make_test_image_file(name="item.png"):
    buffer = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class ItemApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            id="tester",
            password="secret1234",
        )
        self.other_user = get_user_model().objects.create_user(
            id="tester2",
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
        Star.objects.create(item=self.item, user=self.user)
        Star.objects.create(item=self.item, user=self.other_user)

    def test_list_items(self):
        response = self.client.get(reverse("items-list-create"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["name"], self.item.name)
        self.assertEqual(response.data[0]["starCount"], 2)
        self.assertFalse(response.data[0]["isStarred"])

    def test_create_item(self):
        payload = {
            "name": "세라마이드 진정 크림",
            "image": make_test_image_file(),
            "price": 26500,
            "shop_or_brand_name": "MORU",
            "original_url": "https://shop.example.com/products/ceramide-cream",
            "created_by": self.user.id,
        }

        response = self.client.post(reverse("items-list-create"), payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Item.objects.count(), 2)
        created_item = Item.objects.get(original_url=payload["original_url"])
        self.assertEqual(created_item.name, payload["name"])
        self.assertTrue(created_item.image_file.name.startswith("items/"))
        self.assertEqual(response.data["starCount"], 0)
        self.assertIn("/media/items/", response.data["image_url"])

    @patch("apps.items.views.extract_item_info_from_screenshot")
    def test_extract_item_info_from_screenshot(self, mock_extract):
        mock_extract.return_value = {
            "product_name": "이지엔 위생 롤백",
            "shop_name": "EZn이지엔",
            "price_text": "9,900원",
            "price_value": 9900,
            "cropped_image_url": "/media/ai-item-crops/test.png",
            "confidence": {"product_name": 0.97},
            "warnings": ["대표 상품 이미지 영역을 기준으로 crop했습니다."],
        }

        response = self.client.post(
            reverse("items-extract-from-screenshot"),
            {"screenshot": make_test_image_file("screenshot.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "이지엔 위생 롤백")
        self.assertEqual(response.data["shop_or_brand_name"], "EZn이지엔")
        self.assertEqual(response.data["cropped_image_url"], "http://testserver/media/ai-item-crops/test.png")
        self.assertEqual(response.data["price"], 9900)
        mock_extract.assert_called_once()

    def test_extract_item_info_requires_screenshot(self):
        response = self.client.post(
            reverse("items-extract-from-screenshot"),
            {},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "스크린샷 파일을 업로드해 주세요.")

    def test_update_item(self):
        response = self.client.patch(
            reverse("items-detail", args=[self.item.id]),
            {"price": 30000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.price, 30000)

    def test_item_detail_includes_star_summary(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("items-detail", args=[self.item.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["starCount"], 2)
        self.assertTrue(response.data["isStarred"])

    def test_delete_item(self):
        response = self.client.delete(reverse("items-detail", args=[self.item.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Item.objects.filter(id=self.item.id).exists())

    def test_filter_items_by_name(self):
        response = self.client.get(reverse("items-list-create"), {"name": "라벤더"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_ranking_endpoint(self):
        ranked_item = Item.objects.create(
            name="무선 이어폰",
            category=Item.Category.ELECTRONICS,
            image_url="https://example.com/earbuds.jpg",
            price=129000,
            shop_or_brand_name="SOUND LAB",
            original_url="https://shop.example.com/products/earbuds",
        )
        Star.objects.create(item=ranked_item, user=self.user)
        Star.objects.create(item=ranked_item, user=self.other_user)

        response = self.client.get(reverse("item-ranking"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["starCount"], 2)
        self.assertEqual(response.data["results"][0]["rankingScore"], 2)

    def test_categories_endpoint(self):
        response = self.client.get(reverse("item-categories"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0], {"value": "all", "label": "전체"})
        self.assertIn(
            {"value": Item.Category.ELECTRONICS, "label": "전자제품"},
            response.data["results"],
        )

    def test_toggle_star_endpoint(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("item-start", args=[self.item.id]),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Star.objects.filter(item=self.item, user=self.user).exists())

        response = self.client.post(
            reverse("item-start", args=[self.item.id]),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Star.objects.filter(item=self.item, user=self.user).exists())

    def test_star_summary_endpoint(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse("item-star-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item_summary = next(result for result in response.data["results"] if result["id"] == self.item.id)
        self.assertEqual(item_summary["starCount"], 2)
        self.assertTrue(item_summary["isStarred"])


class VisionEnvironmentTests(APITestCase):
    @patch.dict(os.environ, {"PATH": "/usr/bin", "HOME": "/root"}, clear=True)
    @patch("apps.items.vision_service._find_codex_bin", return_value="/root/.nvm/versions/node/v26.4.0/bin/codex")
    def test_build_vision_environment_includes_codex_bin_dir(self, _mock_find_codex_bin):
        env = _build_vision_environment()
        codex_bin_dir = os.path.dirname(env["VISION_CODEX_BIN"])

        self.assertEqual(env["VISION_CODEX_BIN"], "/root/.nvm/versions/node/v26.4.0/bin/codex")
        self.assertEqual(env["PATH"].split(os.pathsep)[0], codex_bin_dir)
        self.assertIn("/usr/bin", env["PATH"].split(os.pathsep))
