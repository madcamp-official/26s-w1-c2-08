from django.conf import settings
from django.db import models


class Item(models.Model):
    class Category(models.TextChoices):
        FASHION = "fashion", "의류/패션"
        FOOD = "food", "식품"
        BEAUTY = "beauty", "뷰티"
        ELECTRONICS = "electronics", "전자제품"
        APPLIANCES = "appliances", "가전제품"
        LIVING = "living", "생활용품"
        HEALTH = "health", "건강"
        SPORTS = "sports", "스포츠/레저"
        BOOKS_HOBBY = "books_hobby", "도서/취미"
        KIDS_PETS = "kids_pets", "유아/반려동물"
        ETC = "etc", "기타"

    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.ETC,
        db_index=True,
    )
    brand_or_shop_name = models.CharField(max_length=120, blank=True)
    product_url = models.URLField(max_length=1000, blank=True)
    normalized_url = models.CharField(max_length=1000, blank=True, db_index=True)
    image_url = models.URLField(max_length=1000, blank=True)
    price_text = models.CharField(max_length=100, blank=True)
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
    )
    external_review_count = models.PositiveIntegerField(null=True, blank=True)
    recommend_count = models.PositiveIntegerField(default=0)
    disrecommend_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["-recommend_count", "-created_at"]),
            models.Index(fields=["category", "-recommend_count", "-created_at"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

    @property
    def ranking_score(self):
        return self.recommend_count - self.disrecommend_count


class ItemReaction(models.Model):
    class Reaction(models.TextChoices):
        RECOMMEND = "recommend", "추천"
        DISRECOMMEND = "disrecommend", "비추천"

    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
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
            models.UniqueConstraint(
                fields=["item", "user"],
                name="unique_item_reaction_per_user",
            )
        ]
        indexes = [
            models.Index(fields=["item", "reaction"]),
            models.Index(fields=["user", "reaction"]),
        ]

    def __str__(self):
        return f"{self.user} -> {self.item} ({self.reaction})"

