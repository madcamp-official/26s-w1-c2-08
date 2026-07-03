from django.conf import settings
from django.db import models
from django.db.models import Count, Q


class Item(models.Model):
    name = models.CharField(max_length=255)
    image_url = models.URLField(blank=True)
    price = models.PositiveIntegerField()
    shop_or_brand_name = models.CharField(max_length=255)
    original_url = models.URLField(unique=True)
    recommend_count = models.PositiveIntegerField(default=0)
    not_recommend_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def refresh_reaction_counts(self, save=True):
        counts = self.reactions.aggregate(
            recommend_total=Count("id", filter=Q(reaction=ItemReaction.Reaction.RECOMMEND)),
            not_recommend_total=Count(
                "id", filter=Q(reaction=ItemReaction.Reaction.NOT_RECOMMEND)
            ),
        )
        self.recommend_count = counts["recommend_total"] or 0
        self.not_recommend_count = counts["not_recommend_total"] or 0
        if save:
            self.save(update_fields=["recommend_count", "not_recommend_count", "updated_at"])


class ItemReaction(models.Model):
    class Reaction(models.TextChoices):
        RECOMMEND = "recommend", "Recommend"
        NOT_RECOMMEND = "not_recommend", "Not Recommend"

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="item_reactions",
    )
    reaction = models.CharField(max_length=20, choices=Reaction.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["item", "user"], name="unique_item_reaction_per_user")
        ]
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.item_id}:{self.user_id}:{self.reaction}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.item.refresh_reaction_counts()

    def delete(self, *args, **kwargs):
        item = self.item
        super().delete(*args, **kwargs)
        item.refresh_reaction_counts()
