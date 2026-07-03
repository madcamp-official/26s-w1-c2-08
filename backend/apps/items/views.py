from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Item, ItemReaction
from .serializers import ItemReactionSerializer, ItemReactionUpsertSerializer, ItemSerializer


class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer

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

        user_id = request.data.get("user_id")
        if user_id is None:
            return Response({"user_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(get_user_model(), id=user_id)
        reaction, created = ItemReaction.objects.update_or_create(
            item=item,
            user=user,
            defaults={"reaction": serializer.validated_data["reaction"]},
        )
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

        reaction, created = ItemReaction.objects.update_or_create(
            item=item,
            user=user,
            defaults={"reaction": serializer.validated_data["reaction"]},
        )
        output = ItemReactionSerializer(reaction)
        return Response(output.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, item_id, user_id):
        reaction = get_object_or_404(ItemReaction, item_id=item_id, user_id=user_id)
        reaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
