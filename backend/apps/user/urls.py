from django.urls import path

from .views import user_profile, user_list, FollowUserView, FollowerListView, FollowingListView, UsernameChangeView

urlpatterns = [
    path('', user_list, name='user-list'),
    path("<int:user_id>/", user_profile, name="user-profile"),
    path("<int:user_id>/follow/", FollowUserView.as_view(), name="user-follow"),
    path("<int:user_id>/followers/", FollowerListView.as_view(), name="user-followers"),
    path("<int:user_id>/following/", FollowingListView.as_view(), name="user-following"),
    path("<int:user_id>/transname/", UsernameChangeView.as_view(), name="user-transusername"),
]
