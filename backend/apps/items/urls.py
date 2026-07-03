from django.urls import path

from .views import (
    ItemDetailView,
    ItemListCreateView,
    ItemReactionDetailView,
    ItemReactionListCreateView,
)

urlpatterns = [
    path("", ItemListCreateView.as_view(), name="items-list-create"),
    path("<int:pk>/", ItemDetailView.as_view(), name="items-detail"),
    path("<int:item_id>/reactions/", ItemReactionListCreateView.as_view(), name="item-reactions"),
    path(
        "<int:item_id>/reactions/<int:user_id>/",
        ItemReactionDetailView.as_view(),
        name="item-reaction-detail",
    ),
]
