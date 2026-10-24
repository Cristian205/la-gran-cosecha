from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CambiarNegocioView,
    CambiarPasswordView,
    LoginView,
    MeView,
    NuevaPasswordResetView,
    SolicitarResetView,
    VerificarResetView,
    PermisosDisponiblesView,
    UsuarioViewSet,
    VerifyOtpView,
)

router = DefaultRouter()
router.register(r"users", UsuarioViewSet, basename="users")

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("verify-otp/", VerifyOtpView.as_view(), name="auth-verify-otp"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", CambiarPasswordView.as_view(), name="auth-change-password"),
    path("cambiar-negocio/", CambiarNegocioView.as_view(), name="auth-cambiar-negocio"),
    path("password-reset/", SolicitarResetView.as_view(), name="auth-password-reset"),
    path("password-reset/verificar/", VerificarResetView.as_view(), name="auth-password-reset-verificar"),
    path("password-reset/nueva/", NuevaPasswordResetView.as_view(), name="auth-password-reset-nueva"),
    path(
        "permisos-disponibles/",
        PermisosDisponiblesView.as_view(),
        name="auth-permisos-disponibles",
    ),
]

urlpatterns += router.urls
