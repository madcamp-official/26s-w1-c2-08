import random
from argparse import BooleanOptionalAction

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.items.models import Item, Star
from apps.reviews.models import Review, ReviewComment, ReviewReaction


class Command(BaseCommand):
    help = "Seed review, comment, item star, and review reaction activity for existing items."

    DENSITY_CONFIG = {
        "low": {
            "review_range": (1, 2),
            "comment_range": (0, 1),
            "star_ratio_range": (0.10, 0.20),
            "review_reaction_range": (0, 1),
        },
        "medium": {
            "review_range": (2, 4),
            "comment_range": (1, 3),
            "star_ratio_range": (0.25, 0.40),
            "review_reaction_range": (1, 3),
        },
        "high": {
            "review_range": (4, 7),
            "comment_range": (2, 5),
            "star_ratio_range": (0.50, 0.70),
            "review_reaction_range": (2, 5),
        },
    }

    REVIEW_TITLE_PREFIXES = [
        "꾸준히 쓰는",
        "생각보다 만족한",
        "재구매 의사 있는",
        "가성비가 괜찮은",
        "주변에 추천한",
        "기대 이상이었던",
    ]
    REVIEW_CONTENT_TEMPLATES = [
        "{name}은(는) {brand}에서 나온 제품 중에서도 만족도가 높았습니다. {detail}",
        "{name} 써보고 나서 장단점이 꽤 분명했습니다. {detail}",
        "{brand} 제품이라 기대했는데 실제 사용감도 괜찮았습니다. {detail}",
        "가격 대비 {name}의 완성도가 좋아서 다시 찾게 될 것 같습니다. {detail}",
    ]
    REVIEW_DETAILS = [
        "자극 없이 무난하게 쓰기 좋았고 마감도 깔끔했습니다.",
        "며칠 써보니 사용감이 안정적이라 손이 자주 갔습니다.",
        "특히 기본 기능이 탄탄해서 기대 이상으로 만족했습니다.",
        "과하게 튀는 부분 없이 전체적으로 밸런스가 괜찮았습니다.",
        "비슷한 제품들과 비교해도 체감 만족도가 꽤 높은 편이었습니다.",
        "처음엔 평범해 보였는데 사용할수록 장점이 잘 느껴졌습니다.",
    ]
    COMMENT_TEMPLATES = [
        "저도 비슷하게 느꼈어요. 특히 {keyword} 부분이 공감됩니다.",
        "후기 덕분에 제품 이해가 잘 됐습니다. {keyword} 정보가 도움이 됐어요.",
        "실사용 기준으로 정리해 주셔서 좋네요. 저도 한 번 써보고 싶습니다.",
        "상세하게 적어주셔서 감사합니다. 구매 전에 참고하기 좋습니다.",
        "{keyword} 얘기해 주신 부분이 특히 궁금했는데 도움이 됐어요.",
    ]
    COMMENT_SUFFIXES = [
        "저도 써보면 비슷한지 확인해 보고 싶네요.",
        "후기 내용이 구체적이라 판단하는 데 도움이 됐습니다.",
        "실사용 기준으로 적어주셔서 믿고 참고할 수 있었습니다.",
        "장단점이 같이 보여서 구매 전에 보기 좋은 후기였습니다.",
        "이런 식의 후기면 다른 사람들에게도 충분히 도움 될 것 같습니다.",
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--mode",
            choices=("additive", "reset", "fill", "clear"),
            default="additive",
            help="How to handle existing review activity.",
        )
        parser.add_argument(
            "--density",
            choices=tuple(self.DENSITY_CONFIG.keys()),
            default="medium",
            help="How much activity to create per item.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=20260707,
            help="Seed for deterministic random generation.",
        )
        parser.add_argument(
            "--reviews",
            action=BooleanOptionalAction,
            default=True,
            help="Generate dummy reviews.",
        )
        parser.add_argument(
            "--item-stars",
            action=BooleanOptionalAction,
            default=True,
            help="Generate dummy item stars.",
        )
        parser.add_argument(
            "--review-comments",
            action=BooleanOptionalAction,
            default=True,
            help="Generate dummy review comments.",
        )
        parser.add_argument(
            "--review-reactions",
            action=BooleanOptionalAction,
            default=True,
            help="Generate dummy review like/dislike reactions.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        mode = options["mode"]
        density = options["density"]
        seed = options["seed"]
        create_reviews = options["reviews"]
        create_item_stars = options["item_stars"]
        create_review_comments = options["review_comments"]
        create_review_reactions = options["review_reactions"]

        rng = random.Random(seed)

        user_model = get_user_model()
        users = list(user_model.objects.filter(is_superuser=False).order_by("id"))
        items = list(Item.objects.select_related("created_by").order_by("id"))

        if mode == "clear":
            deleted_counts = self._clear_selected_activity(
                clear_reviews=create_reviews,
                clear_item_stars=create_item_stars,
                clear_review_comments=create_review_comments,
                clear_review_reactions=create_review_reactions,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "Cleared selected activity: "
                    f"reviews={deleted_counts['reviews']}, "
                    f"comments={deleted_counts['comments']}, "
                    f"item_stars={deleted_counts['item_stars']}, "
                    f"review_reactions={deleted_counts['review_reactions']}."
                )
            )
            return

        if not users:
            self.stdout.write(self.style.WARNING("No eligible non-superuser users found."))
            return
        if not items:
            self.stdout.write(self.style.WARNING("No items found."))
            return

        if mode == "reset":
            deleted_counts = self._clear_selected_activity(
                clear_reviews=create_reviews,
                clear_item_stars=create_item_stars,
                clear_review_comments=create_review_comments,
                clear_review_reactions=create_review_reactions,
            )
            self.stdout.write(
                "Reset selected activity: "
                f"reviews={deleted_counts['reviews']}, "
                f"comments={deleted_counts['comments']}, "
                f"item_stars={deleted_counts['item_stars']}, "
                f"review_reactions={deleted_counts['review_reactions']}"
            )

        counts_before = {
            "reviews": Review.objects.count(),
            "comments": ReviewComment.objects.count(),
            "item_stars": Star.objects.count(),
            "review_reactions": ReviewReaction.objects.count(),
        }

        config = self.DENSITY_CONFIG[density]
        created_review_count = 0
        created_comment_count = 0
        created_item_star_count = 0
        created_review_reaction_count = 0

        for item in items:
            eligible_review_users = [user for user in users if user.id != item.created_by_id]
            if not eligible_review_users:
                continue

            if create_item_stars:
                created_item_star_count += self._seed_stars_for_item(
                    item=item,
                    eligible_users=eligible_review_users,
                    mode=mode,
                    config=config,
                    rng=rng,
                )
            if create_reviews:
                created_review_count += self._seed_reviews_for_item(
                    item=item,
                    eligible_users=eligible_review_users,
                    mode=mode,
                    config=config,
                    rng=rng,
                )

        reviews = list(Review.objects.select_related("item", "author").order_by("id"))
        for review in reviews:
            eligible_other_users = [user for user in users if user.id != review.author_id]
            if not eligible_other_users:
                continue

            if create_review_comments:
                created_comment_count += self._seed_comments_for_review(
                    review=review,
                    eligible_users=eligible_other_users,
                    mode=mode,
                    config=config,
                    rng=rng,
                )
            if create_review_reactions:
                created_review_reaction_count += self._seed_reactions_for_review(
                    review=review,
                    eligible_users=eligible_other_users,
                    mode=mode,
                    config=config,
                    rng=rng,
                )

        counts_after = {
            "reviews": Review.objects.count(),
            "comments": ReviewComment.objects.count(),
            "item_stars": Star.objects.count(),
            "review_reactions": ReviewReaction.objects.count(),
        }
        self.stdout.write(
            self.style.SUCCESS(
                "Seeded review activity "
                f"(mode={mode}, density={density}, seed={seed}): "
                f"items={len(items)}, users={len(users)}, "
                f"created reviews={created_review_count}, "
                f"item_stars={created_item_star_count}, "
                f"comments={created_comment_count}, "
                f"review_reactions={created_review_reaction_count}; "
                f"totals reviews={counts_after['reviews']} (+{counts_after['reviews'] - counts_before['reviews']}), "
                f"comments={counts_after['comments']} (+{counts_after['comments'] - counts_before['comments']}), "
                f"item_stars={counts_after['item_stars']} (+{counts_after['item_stars'] - counts_before['item_stars']}), "
                f"review_reactions={counts_after['review_reactions']} "
                f"(+{counts_after['review_reactions'] - counts_before['review_reactions']})."
            )
        )

    def _clear_selected_activity(
        self,
        *,
        clear_reviews,
        clear_item_stars,
        clear_review_comments,
        clear_review_reactions,
    ):
        clear_review_comments = clear_review_comments or clear_reviews
        clear_review_reactions = clear_review_reactions or clear_reviews
        counts = {
            "reviews": Review.objects.count() if clear_reviews else 0,
            "comments": ReviewComment.objects.count() if clear_review_comments else 0,
            "item_stars": Star.objects.count() if clear_item_stars else 0,
            "review_reactions": ReviewReaction.objects.count() if clear_review_reactions else 0,
        }
        if clear_review_reactions:
            ReviewReaction.objects.all().delete()
        if clear_review_comments:
            ReviewComment.objects.all().delete()
        if clear_reviews:
            Review.objects.all().delete()
        if clear_item_stars:
            Star.objects.all().delete()
        return counts

    def _seed_stars_for_item(self, *, item, eligible_users, mode, config, rng):
        target = self._target_star_count(len(eligible_users), config, rng)
        existing_user_ids = set(Star.objects.filter(item=item).values_list("user_id", flat=True))

        if mode == "additive":
            target = max(target, len(existing_user_ids))
        elif mode == "fill":
            if len(existing_user_ids) >= target:
                return 0

        available_users = [user for user in eligible_users if user.id not in existing_user_ids]
        missing_count = max(0, min(target - len(existing_user_ids), len(available_users)))
        if missing_count == 0:
            return 0

        selected_users = rng.sample(available_users, missing_count)
        Star.objects.bulk_create(
            [Star(item=item, user=user) for user in selected_users],
            ignore_conflicts=True,
        )
        return len(selected_users)

    def _seed_reviews_for_item(self, *, item, eligible_users, mode, config, rng):
        review_min, review_max = config["review_range"]
        target = min(len(eligible_users), rng.randint(review_min, review_max))
        existing_author_ids = set(Review.objects.filter(item=item).values_list("author_id", flat=True))

        if mode == "additive":
            target = max(target, len(existing_author_ids))
        elif mode == "fill" and len(existing_author_ids) >= target:
            return 0

        available_users = [user for user in eligible_users if user.id not in existing_author_ids]
        missing_count = max(0, min(target - len(existing_author_ids), len(available_users)))
        if missing_count == 0:
            return 0

        reviews = []
        for user in rng.sample(available_users, missing_count):
            title = self._build_review_title(item=item, rng=rng)
            content = self._build_review_content(item=item, rng=rng)
            reviews.append(Review(item=item, author=user, title=title, content=content))

        Review.objects.bulk_create(reviews)
        return len(reviews)

    def _seed_comments_for_review(self, *, review, eligible_users, mode, config, rng):
        comment_min, comment_max = config["comment_range"]
        target = min(len(eligible_users), rng.randint(comment_min, comment_max))
        existing_author_ids = set(review.comments.values_list("author_id", flat=True))

        if mode == "additive":
            target = max(target, len(existing_author_ids))
        elif mode == "fill" and len(existing_author_ids) >= target:
            return 0

        available_users = [user for user in eligible_users if user.id not in existing_author_ids]
        missing_count = max(0, min(target - len(existing_author_ids), len(available_users)))
        if missing_count == 0:
            return 0

        comments = []
        for user in rng.sample(available_users, missing_count):
            comments.append(
                ReviewComment(
                    review=review,
                    author=user,
                    content=self._build_comment_content(review=review, rng=rng),
                )
            )

        ReviewComment.objects.bulk_create(comments)
        return len(comments)

    def _seed_reactions_for_review(self, *, review, eligible_users, mode, config, rng):
        reaction_min, reaction_max = config["review_reaction_range"]
        target = min(len(eligible_users), rng.randint(reaction_min, reaction_max))
        existing_user_ids = set(review.reactions.values_list("user_id", flat=True))

        if mode == "additive":
            target = max(target, len(existing_user_ids))
        elif mode == "fill" and len(existing_user_ids) >= target:
            return 0

        available_users = [user for user in eligible_users if user.id not in existing_user_ids]
        missing_count = max(0, min(target - len(existing_user_ids), len(available_users)))
        if missing_count == 0:
            return 0

        reactions = []
        for user in rng.sample(available_users, missing_count):
            reactions.append(
                ReviewReaction(
                    review=review,
                    user=user,
                    reaction=rng.choice(
                        [
                            ReviewReaction.Reaction.LIKE,
                            ReviewReaction.Reaction.DISLIKE,
                        ]
                    ),
                )
            )

        ReviewReaction.objects.bulk_create(reactions)
        for review_reaction in reactions:
            review_reaction.review.refresh_reaction_counts()
        return len(reactions)

    def _target_star_count(self, eligible_user_count, config, rng):
        low, high = config["star_ratio_range"]
        ratio = rng.uniform(low, high)
        return min(eligible_user_count, max(1, round(eligible_user_count * ratio)))

    def _build_review_title(self, *, item, rng):
        prefix = rng.choice(self.REVIEW_TITLE_PREFIXES)
        return f"{prefix} {item.name}"

    def _build_review_content(self, *, item, rng):
        template = rng.choice(self.REVIEW_CONTENT_TEMPLATES)
        detail = rng.choice(self.REVIEW_DETAILS)
        return template.format(name=item.name, brand=item.shop_or_brand_name, detail=detail)

    def _build_comment_content(self, *, review, rng):
        template = rng.choice(self.COMMENT_TEMPLATES)
        source_words = [word for word in review.title.split() if word.strip()]
        keyword = rng.choice(source_words) if source_words else "사용감"
        return f"{template.format(keyword=keyword)} {rng.choice(self.COMMENT_SUFFIXES)}"
