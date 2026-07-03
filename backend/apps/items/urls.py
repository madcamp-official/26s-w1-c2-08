from django.urls import path

from .views import (
    item_categories,
    item_ranking,
    item_ranking_detail,
    item_reaction_toggle,
    ItemDetailView,
    ItemListCreateView,
    ItemReactionDetailView,
    ItemReactionListCreateView,
)

urlpatterns = [
    path("", ItemListCreateView.as_view(), name="items-list-create"),
    path("ranking/", item_ranking, name="item-ranking"),
    path("categories/", item_categories, name="item-categories"),
    path("<int:item_id>/reaction/", item_reaction_toggle, name="item-reaction"),
    path("<int:pk>/", ItemDetailView.as_view(), name="items-detail"),
    path("<int:item_id>/ranking-detail/", item_ranking_detail, name="item-ranking-detail"),
    path("<int:item_id>/reactions/", ItemReactionListCreateView.as_view(), name="item-reactions"),
    path(
        "<int:item_id>/reactions/<int:user_id>/",
        ItemReactionDetailView.as_view(),
        name="item-reaction-detail",
    ),
]
