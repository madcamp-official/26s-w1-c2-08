from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.items.models import Item, Star

User = get_user_model()


def _follower_count_map():
    """유저별 팔로워 수: { user_id: follower_count }"""
    return {
        row["id"]: row["follower_count"]
        for row in User.objects.annotate(
            follower_count=Count("follower_relationships")
        ).values("id", "follower_count")
    }


def _created_item_star_map(category):
    """카테고리 내 유저가 등록한 아이템들이 받은 star 합계: { created_by_id: total_stars }"""
    rows = (
        Item.objects.filter(category=category, created_by__isnull=False)
        .values("created_by")
        .annotate(total_stars=Count("star"))
    )
    return {row["created_by"]: row["total_stars"] for row in rows}


def _recommended_item_count_map(category):
    """카테고리 내에서 유저가 추천(star)한 아이템 수: { user_id: recommended_count }"""
    rows = (
        Star.objects.filter(item__category=category)
        .values("user")
        .annotate(recommended_count=Count("id"))
    )
    return {row["user"]: row["recommended_count"] for row in rows}


@api_view(["GET"])
def recommend(request):
    follower_counts = _follower_count_map()
    usernames = dict(User.objects.values_list("id", "username"))

    # 1. 전역 팔로워 top 10
    top_users = (
        User.objects.annotate(
            follower_count=Count("follower_relationships")
        )
        .order_by("-follower_count", "id")[:10]
    )

    top_user_results = [
        {
            "id": user.id,
            "username": user.username,
            "follower_count": user.follower_count,
        }
        for user in top_users
    ]

    # 2. 팔로워가 가장 많은 유저 1명이 등록한 아이템 중 Star 많은 순 상위 5개
    top_user_items = {"username": "", "items": []}

    if top_users:
        top_user = top_users[0]

        top_items = (
            Item.objects.filter(created_by=top_user)
            .annotate(star_count=Count("star"))
            .order_by("-star_count", "id")[:5]
        )

        top_user_items = {
            "username": top_user.username,
            "items": [
                {
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "price": item.price,
                    "star_count": item.star_count,
                    "shop_or_brand_name": item.shop_or_brand_name,
                }
                for item in top_items
            ],
        }

    # 3. 카테고리별 점수 상위 유저 5명
    by_category = {}

    for category_value, category_label in Item.Category.choices:
        if category_value == Item.Category.ETC:
            continue
        
        created_star_map = _created_item_star_map(category_value)
        recommended_map = _recommended_item_count_map(category_value)

        candidate_user_ids = follower_counts.keys()

        scored_users = []
        for user_id in candidate_user_ids:
            created_stars = created_star_map.get(user_id, 0)
            recommended_count = recommended_map.get(user_id, 0)
            follower_count = follower_counts.get(user_id, 0)

            score = created_stars + recommended_count + follower_count

            scored_users.append(
                {
                    "id": user_id,
                    "username": usernames.get(user_id, ""),
                    "created_item_star_total": created_stars,
                    "recommended_item_count": recommended_count,
                    "follower_count": follower_count,
                    "score": score,
                }
            )

        scored_users.sort(key=lambda item: (-item["score"], item["id"]))

        by_category[category_value] = {
            "category_label": category_label,
            "top_users": scored_users[:5],
        }

    return Response(
        {
            "results": top_user_results,
            "top_user_items": top_user_items,
            "by_category": by_category,
        }
    )