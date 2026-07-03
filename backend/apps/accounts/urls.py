from django.urls import path

from .views import index, login, logout, me, signup

urlpatterns = [
    path("", index, name="accounts-index"),
    path("me/", me, name="accounts-me"),
    path("login/", login, name="accounts-login"),
    path("logout/", logout, name="accounts-logout"),
    path("signup/", signup, name="accounts-signup"),
]
