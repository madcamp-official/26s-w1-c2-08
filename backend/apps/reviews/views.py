from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Review, ReviewComment, ReviewCommentReaction, ReviewReaction
from .serializers import (
    ReviewCommentCreateSerializer,
    ReviewCommentReactionSerializer,
    ReviewCommentReactionToggleSerializer,
    ReviewCommentSerializer,
    ReviewCreateSerializer,
    ReviewReactionSerializer,
    ReviewReactionToggleSerializer,
    ReviewSerializer,
)


def _serializer_context(request):
    return {
        "request": request,
        "user_id": request.query_params.get("user_id") or request.data.get("user_id"),
    }


def _request_user_id(request):
    return request.data.get("user_id") or request.query_params.get("user_id")


def _validate_author_action(author_id, request_user_id):
    if request_user_id is None:
        return Response({"user_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
    if str(author_id) != str(request_user_id):
        return Response({"detail": "작성자만 수정하거나 삭제할 수 있습니다."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _get_review_comment(comment_id, review_id=None):
    queryset = ReviewComment.objects.select_related("review", "author")
    if review_id is not None:
        queryset = queryset.filter(review_id=review_id)
    return get_object_or_404(queryset, id=comment_id)


class ReviewListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        queryset = Review.objects.select_related("item", "author").prefetch_related("comments")
        item_id = self.request.query_params.get("item_id")
        author_id = self.request.query_params.get("author_id")
        q = self.request.query_params.get("q")

        if item_id:
            queryset = queryset.filter(item_id=item_id)
        if author_id:
            queryset = queryset.filter(author_id=author_id)
        if q:
            queryset = queryset.filter(Q(title__icontains=q) | Q(content__icontains=q))
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = ReviewSerializer(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        output = ReviewSerializer(review, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.select_related("item", "author").prefetch_related("comments")

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def retrieve(self, request, *args, **kwargs):
        review = self.get_object()
        serializer = ReviewSerializer(review, context=self.get_serializer_context())
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        error_response = _validate_author_action(review.author_id, _request_user_id(request))
        if error_response is not None:
            return error_response

        serializer = self.get_serializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        output = ReviewSerializer(review, context=self.get_serializer_context())
        return Response(output.data)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        error_response = _validate_author_action(review.author_id, _request_user_id(request))
        if error_response is not None:
            return error_response

        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReviewCommentListCreateView(APIView):
    def get(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        comments = review.comments.select_related("author", "review")
        serializer = ReviewCommentSerializer(
            comments,
            many=True,
            context=_serializer_context(request),
        )
        return Response(serializer.data)

    def post(self, request, review_id):
        review = get_object_or_404(Review, id=review_id)
        serializer = ReviewCommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(review=review)
        output = ReviewCommentSerializer(comment, context=_serializer_context(request))
        return Response(output.data, status=status.HTTP_201_CREATED)


class ReviewCommentDetailView(APIView):
    def get(self, request, comment_id, review_id=None):
        comment = _get_review_comment(comment_id, review_id=review_id)
        serializer = ReviewCommentSerializer(comment, context=_serializer_context(request))
        return Response(serializer.data)

    def patch(self, request, comment_id, review_id=None):
        comment = _get_review_comment(comment_id, review_id=review_id)
        error_response = _validate_author_action(comment.author_id, _request_user_id(request))
        if error_response is not None:
            return error_response

        serializer = ReviewCommentCreateSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        output = ReviewCommentSerializer(comment, context=_serializer_context(request))
        return Response(output.data)

    def delete(self, request, comment_id, review_id=None):
        comment = _get_review_comment(comment_id, review_id=review_id)
        error_response = _validate_author_action(comment.author_id, _request_user_id(request))
        if error_response is not None:
            return error_response

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
def review_reaction_toggle(request, review_id):
    serializer = ReviewReactionToggleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = get_object_or_404(get_user_model(), id=serializer.validated_data["user_id"])
    normalized_reaction = serializer.validated_data["reaction"]

    with transaction.atomic():
        review = get_object_or_404(Review.objects.select_for_update(), id=review_id)
        existing_reaction = (
            ReviewReaction.objects.select_for_update().filter(review=review, user=user).first()
        )

        if existing_reaction is None:
            ReviewReaction.objects.create(review=review, user=user, reaction=normalized_reaction)
        elif existing_reaction.reaction == normalized_reaction:
            existing_reaction.delete()
        else:
            existing_reaction.reaction = normalized_reaction
            existing_reaction.save(update_fields=["reaction", "updated_at"])

        review.refresh_from_db()

    output = ReviewSerializer(review, context=_serializer_context(request))
    return Response(output.data)


@api_view(["POST"])
def review_comment_reaction_toggle(request, comment_id, review_id=None):
    serializer = ReviewCommentReactionToggleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = get_object_or_404(get_user_model(), id=serializer.validated_data["user_id"])
    normalized_reaction = serializer.validated_data["reaction"]

    with transaction.atomic():
        comment = _get_review_comment(comment_id, review_id=review_id)
        existing_reaction = (
            ReviewCommentReaction.objects.select_for_update()
            .filter(comment=comment, user=user)
            .first()
        )

        if existing_reaction is None:
            ReviewCommentReaction.objects.create(
                comment=comment,
                user=user,
                reaction=normalized_reaction,
            )
        elif existing_reaction.reaction == normalized_reaction:
            existing_reaction.delete()
        else:
            existing_reaction.reaction = normalized_reaction
            existing_reaction.save(update_fields=["reaction", "updated_at"])

        comment.refresh_from_db()

    output = ReviewCommentSerializer(comment, context=_serializer_context(request))
    return Response(output.data)


class ReviewReactionListView(APIView):
    def get(self, _request, review_id):
        review = get_object_or_404(Review, id=review_id)
        reactions = review.reactions.select_related("user", "review")
        serializer = ReviewReactionSerializer(reactions, many=True)
        return Response(serializer.data)


class ReviewCommentReactionListView(APIView):
    def get(self, _request, comment_id, review_id=None):
        comment = _get_review_comment(comment_id, review_id=review_id)
        reactions = comment.reactions.select_related("user", "comment")
        serializer = ReviewCommentReactionSerializer(reactions, many=True)
        return Response(serializer.data)
