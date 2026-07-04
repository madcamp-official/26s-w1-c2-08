from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from django.db.models import BooleanField, Count, Exists, OuterRef, Q, Value
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .models import Item, Star, User
from .serializers import (
    ItemRankingSerializer,
    ItemSerializer,
)
from .vision_service import VisionExtractionError, extract_item_info_from_screenshot


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

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Item.objects.all()
        name = self.request.query_params.get("name")
        brand = self.request.query_params.get("shop_or_brand_name")
        original_url = self.request.query_params.get("original_url")
        created_by = self.request.query_params.get("created_by")

        if name:
            queryset = queryset.filter(name__icontains=name)
        if brand:
            queryset = queryset.filter(shop_or_brand_name__icontains=brand)
        if original_url:
            queryset = queryset.filter(
                Q(original_url__iexact=original_url) | Q(original_url__icontains=original_url)
            )
        if created_by:
            queryset = queryset.filter(created_by_id=created_by)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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


class ItemScreenshotExtractView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [AllowAny]

    def post(self, request):
        screenshot = request.FILES.get("screenshot")
        if screenshot is None:
            return Response(
                {"detail": "스크린샷 파일을 업로드해 주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = extract_item_info_from_screenshot(screenshot)
        except VisionExtractionError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "name": result["product_name"],
                "shop_or_brand_name": result["shop_name"],
                "price": result["price_value"],
                "price_text": result["price_text"],
                "cropped_image_url": request.build_absolute_uri(result["cropped_image_url"]),
                "confidence": result["confidence"],
                "warnings": result["warnings"],
            }
        )


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
def user_star_list(request, user_id):
    user = get_object_or_404(User, id=user_id)

    starred_items = Star.objects.filter(user=user).select_related("item")

    data = [
        {
            "itemId": star.item.id,
            "itemName": star.item.name,  # 실제 Item 필드명에 맞게 조정
        }
        for star in starred_items
    ]

    return Response({"results": data})
