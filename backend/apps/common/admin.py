from django.contrib import admin

from .models import Item, ItemReaction


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
        "brand_or_shop_name",
        "recommend_count",
        "disrecommend_count",
        "ranking_score",
        "created_at",
    )
    search_fields = ("name", "brand_or_shop_name", "product_url", "normalized_url")
    list_filter = ("category", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ItemReaction)
class ItemReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "user", "reaction", "created_at")
    search_fields = ("item__name", "user__username")
    list_filter = ("reaction", "created_at")
    readonly_fields = ("created_at", "updated_at")
