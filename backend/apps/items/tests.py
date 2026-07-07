import os
import subprocess
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .duplicate_detection import (
    build_normalized_input,
    trigram_similarity,
)
from .models import Item, Star
from .vision_service import (
    VISION_ENV_FILE,
    VisionExtractionError,
    _build_gemini_api_key_candidates,
    _build_vision_error,
    _build_vision_environment,
    _normalize_extracted_category,
    _run_command,
)


def make_test_image_file(name="item.png"):
    buffer = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class DuplicateDetectionTests(APITestCase):
    def test_build_normalized_input_removes_brand_prefix_and_promotional_phrases(self):
        normalized = build_normalized_input(
            name="MORU BEAUTY 라벤더 세라마이드 수분크림 [대용량] 무료배송",
            brand="MORU BEAUTY",
            price="28,000",
        )

        self.assertEqual(normalized.brand, "moru beauty")
        self.assertEqual(normalized.name, "라벤더 세라마이드 수분크림")
        self.assertEqual(normalized.tokens, ["라벤더", "세라마이드", "수분크림"])
        self.assertEqual(normalized.price, 28000)

    def test_trigram_similarity_handles_spacing_variants(self):
        score = trigram_similarity("세라마이드 수분크림", "세라마이드 수분 크림")

        self.assertGreater(score, 0.8)


class VisionEnvironmentDefaultTests(APITestCase):
    @patch.dict(os.environ, {"VISION_PROVIDER": "gemini", "GEMINI_API_KEY": "test-key"}, clear=True)
    def test_build_vision_environment_sets_gemini_defaults(self):
        env = _build_vision_environment()

        self.assertEqual(env["VISION_PROVIDER"], "gemini")
        self.assertEqual(env["VISION_GEMINI_API_KEY"], "test-key")
        self.assertNotIn("VISION_CODEX_BIN", env)

    @patch.dict(os.environ, {"API_KEY": "fallback-key"}, clear=True)
    @patch("apps.items.vision_service.VISION_ENV_FILE", Path("/tmp/nonexistent-vision-env"))
    def test_build_vision_environment_uses_api_key_fallback(self):
        env = _build_vision_environment()

        self.assertEqual(env["VISION_PROVIDER"], "gemini")
        self.assertEqual(env["VISION_GEMINI_API_KEY"], "fallback-key")

    @patch.dict(os.environ, {}, clear=True)
    def test_build_vision_environment_reads_vision_env_file(self):
        original_content = VISION_ENV_FILE.read_text(encoding="utf-8") if VISION_ENV_FILE.exists() else None
        try:
            VISION_ENV_FILE.write_text("GEMINI_API_KEY=vision-env-key\n", encoding="utf-8")
            env = _build_vision_environment()
        finally:
            if original_content is None:
                VISION_ENV_FILE.unlink(missing_ok=True)
            else:
                VISION_ENV_FILE.write_text(original_content, encoding="utf-8")

        self.assertEqual(env["VISION_PROVIDER"], "gemini")
        self.assertEqual(env["VISION_GEMINI_API_KEY"], "vision-env-key")

    @patch.dict(
        os.environ,
        {
            "VISION_PROVIDER": "gemini",
            "VISION_GEMINI_API_KEY": "primary-key",
            "VISION_GEMINI_API_KEY_2": "secondary-key",
            "GEMINI_API_KEYS": "secondary-key, tertiary-key",
        },
        clear=True,
    )
    def test_build_gemini_api_key_candidates_includes_fallbacks_without_duplicates(self):
        env = _build_vision_environment()

        self.assertEqual(
            _build_gemini_api_key_candidates(env),
            ["primary-key", "secondary-key", "tertiary-key"],
        )

    @patch.dict(os.environ, {"VISION_PROVIDER": "codex"}, clear=True)
    @patch("apps.items.vision_service._find_codex_bin", return_value="/tmp/codex")
    def test_build_vision_environment_keeps_codex_default(self, mock_find_codex_bin):
        env = _build_vision_environment()

        self.assertEqual(env["VISION_PROVIDER"], "codex")
        self.assertEqual(env["VISION_CODEX_BIN"], "/tmp/codex")
        mock_find_codex_bin.assert_called_once()


class ItemApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            id=1,
            username="tester",
            password="secret1234",
        )
        self.other_user = get_user_model().objects.create_user(
            id=2,
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
        Star.objects.create(item=self.item, user=self.user)
        Star.objects.create(item=self.item, user=self.other_user)

    def test_list_items(self):
        response = self.client.get(reverse("items-list-create"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["name"], self.item.name)
        self.assertEqual(response.data[0]["starCount"], 2)
        self.assertFalse(response.data[0]["isStarred"])

    def test_create_item(self):
        self.client.force_authenticate(user=self.user)

        payload = {
            "name": "세라마이드 진정 크림",
            "description": "제가 쓴 것 중에 가장 자극이 없이 진정되는 크림입니다",
            "category": Item.Category.BEAUTY,
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
        self.assertEqual(created_item.category, payload["category"])
        self.assertTrue(created_item.image_file.name.startswith("items/"))
        self.assertEqual(response.data["starCount"], 0)
        self.assertTrue(response.data["image_url"].startswith("/media/items/"))

    def test_create_item_without_original_url(self):
        self.client.force_authenticate(user=self.user)

        payload = {
            "name": "링크 없는 텀블러",
            "description": "보온 유지가 잘 되는 텀블러입니다",
            "price": 19900,
            "shop_or_brand_name": "DAYMATE",
            "original_url": "",
        }

        response = self.client.post(reverse("items-list-create"), payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_item = Item.objects.get(name=payload["name"])
        self.assertIsNone(created_item.original_url)
        self.assertEqual(response.data["original_url"], "")

    def test_create_item_with_long_original_url(self):
        self.client.force_authenticate(user=self.user)

        long_path = "very-long-segment-" * 15
        original_url = f"https://shop.example.com/products/{long_path}?ref={long_path}"

        self.assertGreater(len(original_url), 200)

        payload = {
            "name": "긴 링크 상품",
            "description": "원본 링크가 긴 상품도 등록할 수 있어야 합니다",
            "price": 21900,
            "shop_or_brand_name": "LONGURL",
            "original_url": original_url,
        }

        response = self.client.post(reverse("items-list-create"), payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_item = Item.objects.get(name=payload["name"])
        self.assertEqual(created_item.original_url, original_url)
        self.assertEqual(response.data["original_url"], original_url)

    def test_create_items_with_same_uploaded_filename_get_unique_image_paths(self):
        self.client.force_authenticate(user=self.user)

        first_response = self.client.post(
            reverse("items-list-create"),
            {
                "name": "첫 번째 아이템",
                "description": "첫 번째 아이템 설명",
                "image": make_test_image_file("duplicate-name.png"),
                "price": 1000,
                "shop_or_brand_name": "A",
                "original_url": "",
            },
            format="multipart",
        )
        second_response = self.client.post(
            reverse("items-list-create"),
            {
                "name": "두 번째 아이템",
                "description": "두 번째 아이템 설명",
                "image": make_test_image_file("duplicate-name.png"),
                "price": 2000,
                "shop_or_brand_name": "B",
                "original_url": "",
            },
            format="multipart",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)

        first_item = Item.objects.get(id=first_response.data["id"])
        second_item = Item.objects.get(id=second_response.data["id"])
        self.assertNotEqual(first_item.image_file.name, second_item.image_file.name)

    @patch("apps.items.views.extract_item_info_from_screenshot")
    def test_extract_item_info_from_screenshot(self, mock_extract):
        mock_extract.return_value = {
            "product_name": "이지엔 위생 롤백",
            "category": Item.Category.LIVING,
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
        self.assertEqual(response.data["category"], Item.Category.LIVING)
        self.assertEqual(response.data["shop_or_brand_name"], "EZn이지엔")
        self.assertEqual(response.data["cropped_image_url"], "/media/ai-item-crops/test.png")
        self.assertEqual(response.data["price"], 9900)
        mock_extract.assert_called_once()

    @patch("apps.items.views.logger")
    @patch("apps.items.views.extract_item_info_from_screenshot")
    def test_extract_item_logs_failed_screenshot_request(self, mock_extract, mock_logger):
        mock_extract.side_effect = VisionExtractionError(
            "현재 AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
            error_code="too_many_requests",
            provider="gemini",
            retryable=False,
            status_code=429,
        )

        response = self.client.post(
            reverse("items-extract-from-screenshot"),
            {"screenshot": make_test_image_file("failed-screenshot.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["detail"], "현재 AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.")
        self.assertEqual(response.data["error_code"], "too_many_requests")
        mock_logger.warning.assert_called_once()
        log_message = mock_logger.warning.call_args.args[1]
        self.assertIn("failed-screenshot.png", log_message)
        self.assertIn("too_many_requests", log_message)
        self.assertIn("gemini", log_message)

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

    def test_duplicate_candidates_returns_exact_url_match(self):
        response = self.client.post(
            reverse("item-duplicate-candidates"),
            {
                "name": "완전히 다른 이름",
                "shop_or_brand_name": "다른 브랜드",
                "original_url": self.item.original_url,
                "price": 99999,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_duplicates"])
        self.assertEqual(response.data["candidates"][0]["id"], self.item.id)
        self.assertEqual(response.data["candidates"][0]["similarity_score"], 1.0)

    def test_duplicate_candidates_detects_brand_prefixed_name(self):
        response = self.client.post(
            reverse("item-duplicate-candidates"),
            {
                "name": "MORU BEAUTY 라벤더 세라마이드 수분 크림 [대용량]",
                "shop_or_brand_name": "MORU BEAUTY",
                "price": 27500,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_duplicates"])
        self.assertEqual(response.data["candidates"][0]["id"], self.item.id)
        self.assertGreaterEqual(response.data["candidates"][0]["similarity_score"], 0.85)

    def test_duplicate_candidates_rejects_model_number_mismatch(self):
        Item.objects.create(
            name="SOUNDLAB 블루투스 이어폰 S24",
            category=Item.Category.ELECTRONICS,
            price=129000,
            shop_or_brand_name="SOUNDLAB",
            original_url="https://shop.example.com/products/soundlab-s24",
        )

        response = self.client.post(
            reverse("item-duplicate-candidates"),
            {
                "name": "SOUNDLAB 블루투스 이어폰 S23",
                "shop_or_brand_name": "SOUNDLAB",
                "price": 129000,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            any(candidate["name"] == "SOUNDLAB 블루투스 이어폰 S24" for candidate in response.data["candidates"])
        )

    def test_duplicate_candidates_requires_name(self):
        response = self.client.post(
            reverse("item-duplicate-candidates"),
            {"name": " "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "상품명을 입력해 주세요.")

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
    def test_build_vision_error_maps_quota_error(self):
        error = _build_vision_error(
            'RuntimeError: Gemini API request failed: {"error":{"message":"You do not have enough quota to make this request.","code":"too_many_requests"}}',
            provider="gemini",
        )

        self.assertEqual(error.error_code, "too_many_requests")
        self.assertEqual(error.provider, "gemini")
        self.assertEqual(error.status_code, 429)
        self.assertFalse(error.retryable)

    def test_build_vision_error_marks_api_error_retryable(self):
        error = _build_vision_error(
            'RuntimeError: Gemini API request failed: {"error":{"message":"Internal error encountered.","code":"api_error"}}',
            provider="gemini",
        )

        self.assertEqual(error.error_code, "api_error")
        self.assertEqual(error.provider, "gemini")
        self.assertEqual(error.status_code, 502)
        self.assertTrue(error.retryable)

    @patch.dict(os.environ, {"PATH": "/usr/bin", "HOME": "/root", "VISION_PROVIDER": "codex"}, clear=True)
    @patch("apps.items.vision_service._find_codex_bin", return_value="/root/.nvm/versions/node/v26.4.0/bin/codex")
    def test_build_vision_environment_includes_codex_bin_dir(self, _mock_find_codex_bin):
        env = _build_vision_environment()
        codex_bin_dir = os.path.dirname(env["VISION_CODEX_BIN"])

        self.assertEqual(env["VISION_CODEX_BIN"], "/root/.nvm/versions/node/v26.4.0/bin/codex")
        self.assertEqual(env["PATH"].split(os.pathsep)[0], codex_bin_dir)
        self.assertIn("/usr/bin", env["PATH"].split(os.pathsep))

    def test_normalize_extracted_category_falls_back_to_etc(self):
        self.assertEqual(_normalize_extracted_category("not-a-category"), Item.Category.ETC)
        self.assertEqual(_normalize_extracted_category(Item.Category.FOOD), Item.Category.FOOD)

    @patch("apps.items.vision_service.logger")
    @patch("apps.items.vision_service.subprocess.run")
    def test_run_command_logs_called_process_error_details(self, mock_run, mock_logger):
        error = subprocess.CalledProcessError(
            returncode=1,
            cmd=["bash", "vision/run_extract.sh"],
            output="",
            stderr='RuntimeError: Gemini API request failed: {"error":{"message":"You do not have enough quota to make this request.","code":"too_many_requests"}}',
        )
        mock_run.side_effect = error

        with self.assertRaises(VisionExtractionError):
            _run_command(["bash", "vision/run_extract.sh"])

        mock_logger.exception.assert_called_once()
        log_message = mock_logger.exception.call_args.args[1]
        self.assertIn("vision/run_extract.sh", log_message)
        self.assertIn("too_many_requests", log_message)

    @patch("apps.items.vision_service.time.sleep")
    @patch("apps.items.vision_service.logger")
    @patch("apps.items.vision_service.subprocess.run")
    def test_run_command_retries_transient_api_error(self, mock_run, mock_logger, mock_sleep):
        transient = subprocess.CalledProcessError(
            returncode=1,
            cmd=["bash", "vision/run_extract.sh"],
            output="",
            stderr='RuntimeError: Gemini API request failed: {"error":{"message":"Internal error encountered.","code":"api_error"}}',
        )
        mock_run.side_effect = [transient, None]

        _run_command(["bash", "vision/run_extract.sh"])

        self.assertEqual(mock_run.call_count, 2)
        mock_sleep.assert_called_once()
        self.assertTrue(mock_logger.warning.called)

    @patch.dict(
        os.environ,
        {
            "VISION_PROVIDER": "gemini",
            "VISION_GEMINI_API_KEY": "primary-key",
            "VISION_GEMINI_API_KEY_2": "secondary-key",
        },
        clear=True,
    )
    @patch("apps.items.vision_service.logger")
    @patch("apps.items.vision_service.subprocess.run")
    def test_run_command_falls_back_to_second_gemini_key_after_quota_error(self, mock_run, mock_logger):
        quota_error = subprocess.CalledProcessError(
            returncode=1,
            cmd=["bash", "vision/run_extract.sh"],
            output="",
            stderr='RuntimeError: Gemini API request failed: {"error":{"message":"You do not have enough quota to make this request.","code":"too_many_requests"}}',
        )

        captured_keys = []

        def side_effect(*_args, **kwargs):
            captured_keys.append(kwargs["env"]["VISION_GEMINI_API_KEY"])
            if len(captured_keys) == 1:
                raise quota_error
            return None

        mock_run.side_effect = side_effect

        _run_command(["bash", "vision/run_extract.sh"])

        self.assertEqual(captured_keys, ["primary-key", "secondary-key"])
        self.assertEqual(mock_run.call_count, 2)
        self.assertTrue(mock_logger.warning.called)
