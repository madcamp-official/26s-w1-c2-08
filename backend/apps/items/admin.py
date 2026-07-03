from django.contrib import admin

from .models import Item, ItemReaction


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "shop_or_brand_name",
        "price",
        "recommend_count",
        "not_recommend_count",
        "created_by",
        "created_at",
    )
    search_fields = ("name", "shop_or_brand_name", "original_url")
    list_filter = ("shop_or_brand_name", "created_at")


@admin.register(ItemReaction)
class ItemReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "user", "reaction", "updated_at")
    search_fields = ("item__name", "user__username")
    list_filter = ("reaction", "updated_at")
