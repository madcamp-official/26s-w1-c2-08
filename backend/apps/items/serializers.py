from rest_framework import serializers

from .models import Item, ItemReaction


class ItemSerializer(serializers.ModelSerializer):
    created_by_id = serializers.IntegerField(source="created_by.id", read_only=True)

    class Meta:
        model = Item
        fields = (
            "id",
            "name",
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
