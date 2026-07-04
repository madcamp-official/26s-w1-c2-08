from django.urls import path

from .views import (
    ReviewCommentDetailView,
    ReviewCommentListCreateView,
    ReviewCommentReactionListView,
    ReviewDetailView,
    ReviewListCreateView,
    ReviewReactionListView,
    review_comment_reaction_toggle,
    review_reaction_toggle,
)

urlpatterns = [
    path("", ReviewListCreateView.as_view(), name="reviews-list-create"),
    path("<int:pk>/", ReviewDetailView.as_view(), name="reviews-detail"),
    path("<int:review_id>/comments/", ReviewCommentListCreateView.as_view(), name="review-comments"),
    path(
        "<int:review_id>/comments/<int:comment_id>/",
        ReviewCommentDetailView.as_view(),
        name="review-comment-detail-nested",
    ),
    path(
        "<int:review_id>/comments/<int:comment_id>/reaction/",
        review_comment_reaction_toggle,
        name="review-comment-reaction-nested",
    ),
    path(
        "<int:review_id>/comments/<int:comment_id>/reactions/",
        ReviewCommentReactionListView.as_view(),
        name="review-comment-reactions-nested",
    ),
    path("<int:review_id>/reaction/", review_reaction_toggle, name="review-reaction"),
    path("<int:review_id>/reactions/", ReviewReactionListView.as_view(), name="review-reactions"),
    path("comments/<int:comment_id>/", ReviewCommentDetailView.as_view(), name="review-comment-detail"),
    path(
        "comments/<int:comment_id>/reaction/",
        review_comment_reaction_toggle,
        name="review-comment-reaction",
    ),
    path(
        "comments/<int:comment_id>/reactions/",
        ReviewCommentReactionListView.as_view(),
        name="review-comment-reactions",
    ),
]
