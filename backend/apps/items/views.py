from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.db.models import Count, Exists, OuterRef, BooleanField, Value

from .models import Item, ItemReaction, Star, User
from .serializers import (
    ItemRankingSerializer,
    ItemReactionSerializer,
    ItemReactionUpsertSerializer,
    ItemSerializer,
)


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
    options = [{"value": value, "label": label} for value, label in Item.Category.choices]
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
    queryset = Item.objects.annotate(ranking_score_value=F("recommend_count")).order_by(
        "-ranking_score_value",
        "-recommend_count",
        "-created_at",
        "id",
    )
    if category is not None:
        queryset = queryset.filter(category=category)

    return queryset


class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = Item.objects.all()
        name = self.request.query_params.get("name")
        brand = self.request.query_params.get("shop_or_brand_name")
        original_url = self.request.query_params.get("original_url")

        if name:
            queryset = queryset.filter(name__icontains=name)
        if brand:
            queryset = queryset.filter(shop_or_brand_name__icontains=brand)
        if original_url:
            queryset = queryset.filter(
                Q(original_url__iexact=original_url) | Q(original_url__icontains=original_url)
            )
        return queryset


class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]


@api_view(["GET"])
def item_ranking(request):
    limit, error_response = _parse_ranking_limit(request)
    if error_response is not None:
        return error_response

    category, error_response = _parse_category(request)
    if error_response is not None:
        return error_response

    queryset = _ranked_items_queryset(category=category)
    serializer = ItemRankingSerializer(queryset[:limit], many=True, context={"request": request})
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
def item_ranking_detail(request, item_id):
    item = get_object_or_404(_ranked_items_queryset(), id=item_id)
    serializer = ItemRankingSerializer(item, context={"request": request})
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def item_reaction_toggle(request, item_id):
    requested_reaction = request.data.get("reaction", "recommend")
    if requested_reaction not in {"recommend", None}:
        return Response(
            {"detail": "reaction은 recommend만 지원합니다."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        item = get_object_or_404(Item.objects.select_for_update(), id=item_id)
        existing_reaction = (
            ItemReaction.objects.select_for_update().filter(item=item, user=request.user).first()
        )

        if existing_reaction is None:
            ItemReaction.objects.create(item=item, user=request.user)
        else:
            existing_reaction.delete()

        item.refresh_from_db()

    ranked_item = get_object_or_404(_ranked_items_queryset(), id=item.id)
    serializer = ItemRankingSerializer(ranked_item, context={"request": request})
    return Response(serializer.data)


class ItemReactionListCreateView(APIView):
    def get(self, request, item_id):
        item = get_object_or_404(Item, id=item_id)
        reactions = item.reactions.select_related("user")
        serializer = ItemReactionSerializer(reactions, many=True)
        return Response(serializer.data)

    def post(self, request, item_id):
        return self._upsert_reaction(request, item_id, status.HTTP_201_CREATED)

    def _upsert_reaction(self, request, item_id, success_status):
        item = get_object_or_404(Item, id=item_id)
        serializer = ItemReactionUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("is_recommended", True):
            return Response(
                {"is_recommended": ["False는 지원하지 않습니다. DELETE를 사용하세요."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_id = request.data.get("user_id")
        if user_id is None:
            return Response({"user_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(get_user_model(), id=user_id)
        reaction, created = ItemReaction.objects.get_or_create(item=item, user=user)
        output = ItemReactionSerializer(reaction)
        return Response(output.data, status=success_status if created else status.HTTP_200_OK)


class ItemReactionDetailView(APIView):
    def get(self, request, item_id, user_id):
        reaction = get_object_or_404(
            ItemReaction.objects.select_related("item", "user"),
            item_id=item_id,
            user_id=user_id,
        )
        return Response(ItemReactionSerializer(reaction).data)

    def put(self, request, item_id, user_id):
        item = get_object_or_404(Item, id=item_id)
        user = get_object_or_404(get_user_model(), id=user_id)
        serializer = ItemReactionUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("is_recommended", True):
            return Response(
                {"is_recommended": ["False는 지원하지 않습니다. DELETE를 사용하세요."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reaction, created = ItemReaction.objects.get_or_create(item=item, user=user)
        output = ItemReactionSerializer(reaction)
        return Response(output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, item_id, user_id):
        reaction = get_object_or_404(ItemReaction, item_id=item_id, user_id=user_id)
        reaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(["POST"])
def ItemStar(request, item_id):
    user = request.user

    if not user.is_authenticated:
        return Response({"detail": "로그인이 필요합니다."}, status=status.HTTP_401_UNAUTHORIZED)
    item = get_object_or_404(Item, id=item_id)

    if Star.objects.filter(user=user, item=item).exists():
        Star.objects.filter(user=user, item=item).delete()
        return Response(
            {"detail": "별이 취소되었습니다."},
            status=status.HTTP_200_OK
        )
    else:
        Star.objects.create(user=user, item=item)
        return Response(
        {"detail": "별이 추가되었습니다."},
        status=status.HTTP_201_CREATED
    )

@api_view(["GET"])
@permission_classes([AllowAny])
def item_star_summary(request):
    user = request.user

    stars = Item.objects.annotate(
        starCount=Count("star"),
    )

    if user.is_authenticated:
        stars = stars.annotate(
            isStarred=Exists(
                Star.objects.filter(user=user, item=OuterRef("pk"))
            )
        )
    else:
        stars = stars.annotate(
            isStarred=Value(False, output_field=BooleanField())
        )

    data = stars.values("id", "starCount", "isStarred")
    return Response({"results": list(data)})

@api_view(["GET"])
@permission_classes([AllowAny])
def item_star_detail(request, item_id):
    item = get_object_or_404(Item, id=item_id)
    user = request.user

    star_count = Star.objects.filter(item=item).count()
    is_starred = (
        user.is_authenticated
        and Star.objects.filter(user=user, item=item).exists()
    )

    return Response({
        "id": item.id,
        "starCount": star_count,
        "isStarred": is_starred,
    })

@api_view(["GET"])
@permission_classes([AllowAny])
def user_star_list(request, userid):
    user = get_object_or_404(User, id=userid)

    starred_items = Star.objects.filter(user=user).select_related("item")

    data = [
        {
            "itemId": star.item.id,
            "itemName": star.item.name,  # 실제 Item 필드명에 맞게 조정
        }
        for star in starred_items
    ]

    return Response({"results": data})