from rest_framework import serializers

from .models import Item, ItemReaction


class ItemSerializer(serializers.ModelSerializer):
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)
    image = serializers.ImageField(source="image_file", write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()

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
            "recommend_count",
            "not_recommend_count",
            "created_by",
            "created_by_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "recommend_count",
            "not_recommend_count",
            "created_at",
            "updated_at",
            "created_by_id",
        )

    def get_image_url(self, obj):
        request = self.context.get("request")

        if obj.image_file:
            url = obj.image_file.url
            return request.build_absolute_uri(url) if request else url

        return obj.image_url or ""


class ItemRankingSerializer(serializers.ModelSerializer):
    rankingScore = serializers.SerializerMethodField()
    categoryLabel = serializers.SerializerMethodField()
    recommendCount = serializers.IntegerField(source="recommend_count", read_only=True)
    disrecommendCount = serializers.IntegerField(source="not_recommend_count", read_only=True)
    brandOrShopName = serializers.CharField(source="shop_or_brand_name", read_only=True)
    productUrl = serializers.URLField(source="original_url", read_only=True)
    imageUrl = serializers.SerializerMethodField()
    priceText = serializers.SerializerMethodField()
    externalReviewCount = serializers.SerializerMethodField()
    userReaction = serializers.SerializerMethodField()

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
            "recommendCount",
            "disrecommendCount",
            "rankingScore",
            "userReaction",
        ]

    def get_userReaction(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        reaction = obj.reactions.filter(user=request.user).first()
        if reaction is None:
            return None

        return reaction.reaction

    def get_rankingScore(self, obj):
        return obj.recommend_count - obj.not_recommend_count

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


class ItemReactionSerializer(serializers.ModelSerializer):
    item_id = serializers.IntegerField(source="item.id", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = ItemReaction
        fields = (
            "id",
            "item",
            "item_id",
            "user",
            "user_id",
            "reaction",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "item", "item_id", "user", "user_id", "created_at", "updated_at")


class ItemReactionUpsertSerializer(serializers.Serializer):
    reaction = serializers.ChoiceField(choices=ItemReaction.Reaction.choices)
