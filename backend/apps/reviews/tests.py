from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.items.models import Item, Star
from apps.reviews.models import Review, ReviewComment, ReviewReaction


class SeedReviewActivityCommandTests(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.owner = self.user_model.objects.create_user(username="owner", password="secret1234")
        self.user1 = self.user_model.objects.create_user(username="user1", password="secret1234")
        self.user2 = self.user_model.objects.create_user(username="user2", password="secret1234")
        self.user3 = self.user_model.objects.create_user(username="user3", password="secret1234")
        self.superuser = self.user_model.objects.create_superuser(
            username="admin",
            password="secret1234",
        )
        self.item = Item.objects.create(
            name="테스트 아이템",
            category=Item.Category.BEAUTY,
            image_url="https://example.com/item.jpg",
            price=10000,
            shop_or_brand_name="TEST",
            original_url="https://example.com/items/1",
            created_by=self.owner,
        )

    def test_default_command_creates_reviews_comments_and_stars(self):
        call_command("seed_review_activity", stdout=StringIO())

        self.assertGreater(Review.objects.count(), 0)
        self.assertGreater(ReviewComment.objects.count(), 0)
        self.assertGreater(Star.objects.count(), 0)
        self.assertGreater(ReviewReaction.objects.count(), 0)
        self.assertNotIn(" the ", Review.objects.first().content.lower())
        self.assertNotIn(" the ", ReviewComment.objects.first().content.lower())

    def test_additive_mode_does_not_create_duplicate_item_reviews_for_same_user(self):
        out = StringIO()

        call_command("seed_review_activity", "--seed", "7", stdout=out)
        review_pairs_after_first_run = set(Review.objects.values_list("item_id", "author_id"))

        call_command("seed_review_activity", "--seed", "7", stdout=out)
        review_pairs_after_second_run = list(Review.objects.values_list("item_id", "author_id"))

        self.assertEqual(len(review_pairs_after_second_run), len(set(review_pairs_after_second_run)))
        self.assertEqual(review_pairs_after_first_run, set(review_pairs_after_second_run))

    def test_command_excludes_item_owner_from_reviews_and_review_author_from_comments(self):
        call_command("seed_review_activity", "--seed", "11", stdout=StringIO())

        self.assertFalse(Review.objects.filter(item=self.item, author=self.owner).exists())
        self.assertFalse(
            ReviewComment.objects.filter(review__author_id=self.owner.id, author_id=self.owner.id).exists()
        )
        self.assertFalse(
            ReviewComment.objects.filter(review__author_id=self.user1.id, author_id=self.user1.id).exists()
        )
        self.assertFalse(
            ReviewComment.objects.filter(review__author_id=self.user2.id, author_id=self.user2.id).exists()
        )
        self.assertFalse(
            ReviewComment.objects.filter(review__author_id=self.user3.id, author_id=self.user3.id).exists()
        )

    def test_reset_mode_replaces_existing_activity(self):
        existing_review = Review.objects.create(
            item=self.item,
            author=self.user1,
            title="기존 리뷰",
            content="기존 리뷰 본문",
        )
        ReviewComment.objects.create(
            review=existing_review,
            author=self.user2,
            content="기존 댓글",
        )
        Star.objects.create(item=self.item, user=self.user1)

        call_command("seed_review_activity", "--mode", "reset", "--seed", "17", stdout=StringIO())

        self.assertFalse(Review.objects.filter(title="기존 리뷰").exists())
        self.assertFalse(ReviewComment.objects.filter(content="기존 댓글").exists())
        self.assertGreater(Review.objects.count(), 0)
        self.assertGreater(ReviewComment.objects.count(), 0)
        self.assertGreater(Star.objects.count(), 0)

    def test_fill_mode_only_adds_missing_activity_up_to_target(self):
        Review.objects.create(
            item=self.item,
            author=self.user1,
            title="선행 리뷰",
            content="이미 있는 리뷰",
        )
        initial_reviews = Review.objects.count()

        call_command("seed_review_activity", "--mode", "fill", "--seed", "7", stdout=StringIO())
        after_first_fill = Review.objects.count()

        call_command("seed_review_activity", "--mode", "fill", "--seed", "7", stdout=StringIO())
        after_second_fill = Review.objects.count()

        self.assertGreaterEqual(after_first_fill, initial_reviews)
        self.assertEqual(after_first_fill, after_second_fill)

    def test_command_warns_when_no_eligible_users_or_items(self):
        Review.objects.all().delete()
        ReviewComment.objects.all().delete()
        Star.objects.all().delete()
        Item.objects.all().delete()
        self.user_model.objects.exclude(is_superuser=True).delete()

        out = StringIO()
        call_command("seed_review_activity", stdout=out)

        self.assertIn("No eligible non-superuser users found.", out.getvalue())

    def test_clear_mode_deletes_existing_reviews_and_comments_without_touching_stars(self):
        review = Review.objects.create(
            item=self.item,
            author=self.user1,
            title="기존 리뷰",
            content="기존 리뷰 본문",
        )
        ReviewComment.objects.create(
            review=review,
            author=self.user2,
            content="기존 댓글",
        )
        ReviewReaction.objects.create(
            review=review,
            user=self.user3,
            reaction=ReviewReaction.Reaction.LIKE,
        )
        Star.objects.create(item=self.item, user=self.user3)

        call_command("seed_review_activity", "--mode", "clear", stdout=StringIO())

        self.assertEqual(Review.objects.count(), 0)
        self.assertEqual(ReviewComment.objects.count(), 0)
        self.assertEqual(ReviewReaction.objects.count(), 0)
        self.assertEqual(Star.objects.count(), 1)

    def test_can_disable_item_star_generation(self):
        call_command(
            "seed_review_activity",
            "--no-item-stars",
            "--reviews",
            "--review-comments",
            "--review-reactions",
            stdout=StringIO(),
        )

        self.assertGreater(Review.objects.count(), 0)
        self.assertGreater(ReviewComment.objects.count(), 0)
        self.assertGreater(ReviewReaction.objects.count(), 0)
        self.assertEqual(Star.objects.count(), 0)

    def test_can_generate_only_review_reactions_for_existing_reviews(self):
        review = Review.objects.create(
            item=self.item,
            author=self.user1,
            title="기존 리뷰",
            content="기존 리뷰 본문",
        )

        call_command(
            "seed_review_activity",
            "--no-reviews",
            "--no-item-stars",
            "--no-review-comments",
            "--review-reactions",
            "--seed",
            "17",
            stdout=StringIO(),
        )

        self.assertEqual(Review.objects.count(), 1)
        self.assertEqual(ReviewComment.objects.count(), 0)
        self.assertEqual(Star.objects.count(), 0)
        self.assertGreater(ReviewReaction.objects.filter(review=review).count(), 0)
