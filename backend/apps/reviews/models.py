from django.conf import settings
from django.db import models
from django.db.models import Count, Q

from apps.items.models import Item


class Review(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()
    like_count = models.PositiveIntegerField(default=0)
    dislike_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["item", "-created_at"]),
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["-like_count", "-created_at"]),
        ]

    def __str__(self):
        return self.title

    def refresh_reaction_counts(self, save=True):
        counts = self.reactions.aggregate(
            like_total=Count("id", filter=Q(reaction=ReviewReaction.Reaction.LIKE)),
            dislike_total=Count("id", filter=Q(reaction=ReviewReaction.Reaction.DISLIKE)),
        )
        self.like_count = counts["like_total"] or 0
        self.dislike_count = counts["dislike_total"] or 0
        if save:
            self.save(update_fields=["like_count", "dislike_count", "updated_at"])


class ReviewReaction(models.Model):
    class Reaction(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_reactions",
    )
    reaction = models.CharField(max_length=20, choices=Reaction.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["review", "user"],
                name="unique_review_reaction_per_user",
            )
        ]
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.review_id}:{self.user_id}:{self.reaction}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.review.refresh_reaction_counts()

    def delete(self, *args, **kwargs):
        review = self.review
        super().delete(*args, **kwargs)
        review.refresh_reaction_counts()


class ReviewComment(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_comments",
    )
    content = models.TextField()
    like_count = models.PositiveIntegerField(default=0)
    dislike_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["review", "created_at"]),
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["-like_count", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.review_id}:{self.author_id}"

    def refresh_reaction_counts(self, save=True):
        counts = self.reactions.aggregate(
            like_total=Count("id", filter=Q(reaction=ReviewCommentReaction.Reaction.LIKE)),
            dislike_total=Count(
                "id",
                filter=Q(reaction=ReviewCommentReaction.Reaction.DISLIKE),
            ),
        )
        self.like_count = counts["like_total"] or 0
        self.dislike_count = counts["dislike_total"] or 0
        if save:
            self.save(update_fields=["like_count", "dislike_count", "updated_at"])


class ReviewCommentReaction(models.Model):
    class Reaction(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"

    comment = models.ForeignKey(
        ReviewComment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_comment_reactions",
    )
    reaction = models.CharField(max_length=20, choices=Reaction.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="unique_review_comment_reaction_per_user",
            )
        ]
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.comment_id}:{self.user_id}:{self.reaction}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.comment.refresh_reaction_counts()

    def delete(self, *args, **kwargs):
        comment = self.comment
        super().delete(*args, **kwargs)
        comment.refresh_reaction_counts()

