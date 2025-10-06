# backend/authentication/urls.py
from django.urls import path, include
from . import views

app_name = "authentication"

urlpatterns = [
    # Autenticación
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    
    # Google OAuth (NUEVO - para @react-oauth/google)
    path("google/", views.google_oauth_login, name="google-oauth"),
    
    # Google OAuth (allauth - mantener por compatibilidad)
    path('accounts/', include('allauth.urls')),
    path("google/login/", views.GoogleLogin.as_view(), name="google-login"),

    # Perfil
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("profile/detail/", views.ProfileDetailView.as_view(), name="profile-detail"),
    path("user-info/", views.user_info, name="user-info"),

    # Restablecimiento de contraseña
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("validate-reset-token/", views.validate_reset_token, name="validate-reset-token"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("check-email/", views.check_email_exists, name="check-email"),
    
    # Gestión de notificaciones
    path("unsubscribe/<str:signed_token>/", views.unsubscribe_notifications, name="unsubscribe"),
    path("resubscribe/<str:signed_token>/", views.resubscribe_notifications, name="resubscribe"),
]