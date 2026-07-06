from pathlib import Path
from uuid import uuid4

from rest_framework import serializers

from .models import Item, ItemChangeRequest, Star


class ItemSerializer(serializers.ModelSerializer):
    created_by_id = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    image = serializers.ImageField(source="image_file", write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    starCount = serializers.SerializerMethodField()
    isStarred = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = (
            "id",
            "name",
            "description",
            "category",
            "image",
            "image_url",
            "price",
            "shop_or_brand_name",
            "original_url",
            "starCount",
            "isStarred",
            "created_by",
            "created_by_id",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "starCount",
            "isStarred",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_id",
            "created_by_username",
        )
        extra_kwargs = {
            "original_url": {
                "required": False,
                "allow_blank": True,
                "allow_null": True,
            },
            "description": {
                "required": True,
                "allow_blank": False,
            },
        }

    def to_internal_value(self, data):
        mutable_data = data.copy()
        original_url = mutable_data.get("original_url")
        if original_url == "":
            mutable_data["original_url"] = None
        validated = super().to_internal_value(mutable_data)
        image_file = validated.get("image_file")
        if image_file is not None:
            extension = Path(image_file.name or "").suffix.lower() or ".png"
            image_file.name = f"{uuid4().hex}{extension}"
        return validated

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["original_url"] = instance.original_url or ""
        return data

    def get_created_by_id(self, obj):
        return obj.created_by_id

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by_id else None

    def get_image_url(self, obj):
        if obj.image_file:
            return obj.image_file.url

        return obj.image_url or ""

    def get_starCount(self, obj):
        return getattr(obj, "starCount", Star.objects.filter(item=obj).count())

    def get_isStarred(self, obj):
        annotated_value = getattr(obj, "isStarred", None)
        if annotated_value is not None:
            return annotated_value

        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return False

        return Star.objects.filter(item=obj, user=request.user).exists()


class ItemRankingSerializer(serializers.ModelSerializer):
    categoryLabel = serializers.SerializerMethodField()
    starCount = serializers.IntegerField(read_only=True)
    rankingScore = serializers.IntegerField(source="starCount", read_only=True)
    brandOrShopName = serializers.CharField(source="shop_or_brand_name", read_only=True)
    productUrl = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()
    priceText = serializers.SerializerMethodField()
    externalReviewCount = serializers.SerializerMethodField()
    isStarred = serializers.SerializerMethodField()
    createdBy = serializers.IntegerField(source="created_by_id", read_only=True)
    createdByUsername = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            "id",
            "name",
            "category",
            "categoryLabel",
            "brandOrShopName",
            "productUrl",
            "imageUrl",
            "priceText",
            "externalReviewCount",
            "starCount",
            "rankingScore",
            "isStarred",
            "createdBy",
            "createdByUsername",
        ]

    def get_createdByUsername(self, obj):
        return obj.created_by.username if obj.created_by_id else None

    def get_isStarred(self, obj):
        annotated_value = getattr(obj, "isStarred", None)
        if annotated_value is not None:
            return annotated_value

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False

        return Star.objects.filter(item=obj, user=request.user).exists()

    def get_categoryLabel(self, obj):
        return obj.get_category_display()

    def get_priceText(self, obj):
        return f"{obj.price:,}원" if obj.price else ""

    def get_externalReviewCount(self, _obj):
        return None

    def get_imageUrl(self, obj):
        if obj.image_file:
            return obj.image_file.url

        return obj.image_url or ""

    def get_productUrl(self, obj):
        return obj.original_url or ""


class ItemChangeRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemChangeRequest
        fields = (
            "id",
            "item",
            "request_type",
            "requested_fields",
            "reason",
            "status",
            "admin_note",
            "created_at",
            "resolved_at",
        )
        read_only_fields = ("id", "status", "admin_note", "created_at", "resolved_at")

    def validate(self, attrs):
        request_type = attrs.get("request_type")
        requested_fields = attrs.get("requested_fields") or {}

        if request_type == ItemChangeRequest.RequestType.EDIT:
            if not requested_fields:
                raise serializers.ValidationError(
                    {"requested_fields": "변경할 필드를 하나 이상 입력해 주세요."}
                )

            invalid_keys = set(requested_fields) - set(ItemChangeRequest.EDITABLE_FIELDS)
            if invalid_keys:
                raise serializers.ValidationError(
                    {"requested_fields": f"수정할 수 없는 필드입니다: {', '.join(sorted(invalid_keys))}"}
                )

            attrs["requested_fields"] = self._normalize_requested_fields(requested_fields)
        else:
            attrs["requested_fields"] = {}

        return attrs

    def _normalize_requested_fields(self, requested_fields):
        normalized = {}

        for field, value in requested_fields.items():
            if field == "price":
                try:
                    price = int(value)
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"requested_fields": "가격은 숫자로 입력해 주세요."})
                if price <= 0:
                    raise serializers.ValidationError({"requested_fields": "가격은 0보다 커야 합니다."})
                normalized[field] = price
            elif field == "category":
                if value not in Item.Category.values:
                    raise serializers.ValidationError({"requested_fields": "올바르지 않은 카테고리입니다."})
                normalized[field] = value
            elif field in ("name", "shop_or_brand_name"):
                text = str(value).strip()
                if not text:
                    raise serializers.ValidationError({"requested_fields": f"{field}은(는) 비워둘 수 없습니다."})
                normalized[field] = text
            elif field == "original_url":
                normalized[field] = str(value).strip()
            elif field == "description":
                normalized[field] = str(value).strip()

        return normalized
