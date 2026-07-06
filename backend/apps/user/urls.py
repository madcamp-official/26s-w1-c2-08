from django.urls import path

from .views import user_profile, user_list, FollowUserView, FollowerListView, FollowingListView

urlpatterns = [
    path('', user_list, name='user-list'),
    path("<str:username>/", user_profile, name="user-profile"),
    path("<int:user_id>/follow/", FollowUserView.as_view(), name="user-follow"),
    path("<int:user_id>/followers/", FollowerListView.as_view(), name="user-followers"),
    path("<int:user_id>/following/", FollowingListView.as_view(), name="user-following"),
]
