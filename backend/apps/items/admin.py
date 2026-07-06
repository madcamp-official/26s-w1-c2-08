from django.contrib import admin
from django.utils import timezone

from .models import Item, ItemChangeRequest, Star


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


@admin.register(ItemChangeRequest)
class ItemChangeRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "item",
        "request_type",
        "status",
        "requested_by",
        "created_at",
        "resolved_at",
    )
    list_filter = ("status", "request_type")
    search_fields = ("item__name", "requested_by__username", "reason")
    readonly_fields = (
        "item",
        "requested_by",
        "request_type",
        "requested_fields",
        "reason",
        "created_at",
    )
    actions = ["approve_requests", "reject_requests"]

    def approve_requests(self, request, queryset):
        applied = 0

        for change_request in queryset.filter(status=ItemChangeRequest.Status.PENDING):
            item = change_request.item

            change_request.status = ItemChangeRequest.Status.APPROVED
            change_request.resolved_at = timezone.now()
            change_request.save(update_fields=["status", "resolved_at"])

            if item is not None:
                if change_request.request_type == ItemChangeRequest.RequestType.EDIT:
                    Item.objects.filter(id=item.id).update(**change_request.requested_fields)
                else:
                    item.delete()

            applied += 1

        self.message_user(request, f"{applied}건을 승인하고 반영했습니다.")

    approve_requests.short_description = "선택한 요청 승인 (실제 반영)"

    def reject_requests(self, request, queryset):
        updated = queryset.filter(status=ItemChangeRequest.Status.PENDING).update(
            status=ItemChangeRequest.Status.REJECTED,
            resolved_at=timezone.now(),
        )
        self.message_user(request, f"{updated}건을 거절했습니다.")

    reject_requests.short_description = "선택한 요청 거절"
