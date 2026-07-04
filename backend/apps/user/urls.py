from django.urls import path

from .views import user_profile, user_list

urlpatterns = [
    path('', user_list, name='user-list'),
    path("<str:username>/", user_profile, name="user-profile"),
]
