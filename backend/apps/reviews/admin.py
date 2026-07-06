from django.contrib import admin

from .models import Review, ReviewComment, ReviewCommentReaction, ReviewReaction


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "author", "title", "like_count", "dislike_count", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title", "content", "item__name", "author__username")


@admin.register(ReviewComment)
class ReviewCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "review", "author", "like_count", "dislike_count", "created_at")
    list_filter = ("created_at",)
    search_fields = ("content", "author__username")


@admin.register(ReviewReaction)
class ReviewReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "review", "user", "reaction", "created_at")
    list_filter = ("reaction",)
    search_fields = ("review__title", "user__username")


@admin.register(ReviewCommentReaction)
class ReviewCommentReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "user", "reaction", "created_at")
    list_filter = ("reaction",)
    search_fields = ("user__username",)
