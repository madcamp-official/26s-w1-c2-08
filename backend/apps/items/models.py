from django.conf import settings
from django.db import models

from apps.accounts.models import User

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
    description = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.ETC,
        db_index=True,
    )
    image_url = models.URLField(blank=True)
    image_file = models.ImageField(upload_to="items/", blank=True, null=True)
    price = models.PositiveIntegerField()
    shop_or_brand_name = models.CharField(max_length=255)
    original_url = models.URLField(unique=True, blank=True, null=True)
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
        indexes = [
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name

class Star(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "item"],
                name="unique_user_item_star"
            )
        ]
