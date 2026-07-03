from rest_framework import serializers

from .models import Item


class ItemRankingSerializer(serializers.ModelSerializer):
    rankingScore = serializers.SerializerMethodField()
    categoryLabel = serializers.SerializerMethodField()
    recommendCount = serializers.IntegerField(source="recommend_count", read_only=True)
    disrecommendCount = serializers.IntegerField(
        source="disrecommend_count",
        read_only=True,
    )
    brandOrShopName = serializers.CharField(
        source="brand_or_shop_name",
        read_only=True,
    )
    productUrl = serializers.URLField(source="product_url", read_only=True)
    imageUrl = serializers.URLField(source="image_url", read_only=True)
    priceText = serializers.CharField(source="price_text", read_only=True)
    externalReviewCount = serializers.IntegerField(
        source="external_review_count",
        read_only=True,
    )
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
        return obj.recommend_count - obj.disrecommend_count

    def get_categoryLabel(self, obj):
        return obj.get_category_display()
