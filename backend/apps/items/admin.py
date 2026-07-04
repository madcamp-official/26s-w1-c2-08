from django.contrib import admin

from .models import Item, Star


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "shop_or_brand_name",
        "price",
        "created_by",
        "created_at",
    )
    search_fields = ("name", "shop_or_brand_name", "original_url")
    list_filter = ("shop_or_brand_name", "created_at")


@admin.register(Star)
class StarAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "user")
    search_fields = ("item__name", "user__username")
