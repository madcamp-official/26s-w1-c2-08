from django.urls import path

from .views import item_categories, item_detail, item_ranking, item_reaction

urlpatterns = [
    path("", item_ranking, name="item-list"),
    path("ranking/", item_ranking, name="item-ranking"),
    path("categories/", item_categories, name="item-categories"),
    path("<int:item_id>/", item_detail, name="item-detail"),
    path("<int:item_id>/reaction/", item_reaction, name="item-reaction"),
]

