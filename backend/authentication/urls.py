# backend/authentication/urls.py
from django.urls import path
from . import views

app_name = "authentication"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),

    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("profile/detail/", views.ProfileDetailView.as_view(), name="profile-detail"),
    path("user-info/", views.user_info, name="user-info"),

    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("password-reset/validate-token/", views.validate_reset_token, name="validate-reset-token"),

    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
]
