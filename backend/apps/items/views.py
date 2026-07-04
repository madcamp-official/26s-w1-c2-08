from django.db.models import BooleanField, Count, Exists, OuterRef, Q, Value
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from .models import Item, Star
from .serializers import ItemRankingSerializer, ItemSerializer


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
    queryset = Item.objects.annotate(
        starCount=Count("star"),
        ranking_score_value=Count("star"),
    ).order_by(
        "-ranking_score_value",
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
    serializer_class = ItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = Item.objects.annotate(starCount=Count("star"))

        if self.request.user.is_authenticated:
            return queryset.annotate(
                isStarred=Exists(Star.objects.filter(user=self.request.user, item=OuterRef("pk")))
            )

        return queryset.annotate(isStarred=Value(False, output_field=BooleanField()))


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
