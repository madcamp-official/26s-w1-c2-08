from rest_framework import serializers

from .models import Item, Star


class ItemSerializer(serializers.ModelSerializer):
    created_by_id = serializers.SerializerMethodField()
    image = serializers.ImageField(source="image_file", write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    starCount = serializers.SerializerMethodField()
    isStarred = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = (
            "id",
            "name",
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
        )

    def get_created_by_id(self, obj):
        return obj.created_by_id

    def get_image_url(self, obj):
        request = self.context.get("request")

        if obj.image_file:
            url = obj.image_file.url
            return request.build_absolute_uri(url) if request else url

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
    productUrl = serializers.URLField(source="original_url", read_only=True)
    imageUrl = serializers.SerializerMethodField()
    priceText = serializers.SerializerMethodField()
    externalReviewCount = serializers.SerializerMethodField()
    isStarred = serializers.SerializerMethodField()

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
        ]

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
        request = self.context.get("request")

        if obj.image_file:
            url = obj.image_file.url
            return request.build_absolute_uri(url) if request else url

        return obj.image_url or ""