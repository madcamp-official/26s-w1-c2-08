from django.urls import path

from .views import index, login, signup

urlpatterns = [
    path("", index, name="accounts-index"),
    path("login/", login, name="accounts-login"),
    path("signup/", signup, name="accounts-signup"),
    path("<str:username>/", index, name="user-profile"),
]
