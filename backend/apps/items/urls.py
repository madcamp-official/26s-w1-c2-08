from django.urls import path

from .views import (
    item_categories,
    item_ranking,
    item_ranking_detail,
    ItemDetailView,
    ItemListCreateView,
    ItemStar,
    item_star_summary,
    item_star_detail,
    user_star_list,
)

urlpatterns = [
    path("", ItemListCreateView.as_view(), name="items-list-create"),
    path("ranking/", item_ranking, name="item-ranking"),
    path("categories/", item_categories, name="item-categories"),
    path("<int:pk>/", ItemDetailView.as_view(), name="items-detail"),
    path("<int:item_id>/ranking-detail/", item_ranking_detail, name="item-ranking-detail"),
    path("<int:item_id>/star/", ItemStar, name="item-start"),
    path("star-summary/", item_star_summary, name="item-star-summary"),
    path("<int:item_id>/star-summary/", item_star_detail, name="item-star-detail"),
    path("users/<int:user_id>/stars/", user_star_list, name="user-star-list"),
]
