from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Item, ItemReaction
from .serializers import ItemRankingSerializer


DEFAULT_RANKING_LIMIT = 20
MAX_RANKING_LIMIT = 100


def _parse_ranking_limit(request):
    raw_limit = request.query_params.get("limit", DEFAULT_RANKING_LIMIT)
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        return None, Response(
            {"detail": "limit은 숫자여야 합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if limit < 1:
        return None, Response(
            {"detail": "limit은 1 이상이어야 합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return min(limit, MAX_RANKING_LIMIT), None


def _category_options(include_all=False):
    options = [
        {"value": value, "label": label}
        for value, label in Item.Category.choices
    ]
    if include_all:
        return [{"value": "all", "label": "전체"}, *options]

    return options


def _parse_category(request):
    category = request.query_params.get("category")
    if not category or category == "all":
        return None, None

    if category not in Item.Category.values:
        return None, Response(
            {
                "detail": "존재하지 않는 카테고리입니다.",
                "categories": _category_options(),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return category, None


def _ranked_items_queryset(category=None):
    queryset = (
        Item.objects.annotate(
            ranking_score_value=F("recommend_count") - F("disrecommend_count")
        )
        .order_by(
            "-ranking_score_value",
            "-recommend_count",
            "disrecommend_count",
            "-created_at",
            "id",
        )
    )
    if category is not None:
        queryset = queryset.filter(category=category)

    return queryset


def _apply_reaction_delta(item_id, reaction, delta):
    field_name = (
        "recommend_count"
        if reaction == ItemReaction.Reaction.RECOMMEND
        else "disrecommend_count"
    )
    Item.objects.filter(id=item_id).update(**{field_name: F(field_name) + delta})


@api_view(["GET"])
def item_ranking(request):
    limit, error_response = _parse_ranking_limit(request)
    if error_response is not None:
        return error_response

    category, error_response = _parse_category(request)
    if error_response is not None:
        return error_response

    queryset = _ranked_items_queryset(category=category)
    serializer = ItemRankingSerializer(
        queryset[:limit],
        many=True,
        context={"request": request},
    )
    return Response(
        {
            "count": queryset.count(),
            "limit": limit,
            "category": category or "all",
            "results": serializer.data,
        }
    )


@api_view(["GET"])
def item_categories(_request):
    return Response({"results": _category_options(include_all=True)})


@api_view(["GET"])
def item_detail(request, item_id):
    item = get_object_or_404(
        _ranked_items_queryset(),
        id=item_id,
    )
    serializer = ItemRankingSerializer(item, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def item_reaction(request, item_id):
    requested_reaction = request.data.get("reaction")
    valid_reactions = ItemReaction.Reaction.values

    if requested_reaction not in valid_reactions:
        return Response(
            {
                "detail": "reaction은 recommend 또는 disrecommend 중 하나여야 합니다."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        item = get_object_or_404(Item.objects.select_for_update(), id=item_id)
        existing_reaction = (
            ItemReaction.objects.select_for_update()
            .filter(item=item, user=request.user)
            .first()
        )

        if existing_reaction is None:
            ItemReaction.objects.create(
                item=item,
                user=request.user,
                reaction=requested_reaction,
            )
            _apply_reaction_delta(item.id, requested_reaction, 1)
        elif existing_reaction.reaction == requested_reaction:
            _apply_reaction_delta(item.id, existing_reaction.reaction, -1)
            existing_reaction.delete()
        else:
            _apply_reaction_delta(item.id, existing_reaction.reaction, -1)
            _apply_reaction_delta(item.id, requested_reaction, 1)
            existing_reaction.reaction = requested_reaction
            existing_reaction.save(update_fields=["reaction", "updated_at"])

        item.refresh_from_db()

    ranked_item = get_object_or_404(_ranked_items_queryset(), id=item.id)
    serializer = ItemRankingSerializer(ranked_item, context={"request": request})
    return Response(serializer.data)

