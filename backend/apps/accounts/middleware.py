"""
Bloquea cualquier llamada a la API (salvo las de autenticación/cambio de
clave) mientras el usuario tenga `debe_cambiar_password=True`.

Como la app usa JWT sin sesiones, `request.user` no está resuelto todavía a
esta altura (eso lo hace DRF dentro de cada vista) — se autentica el JWT acá
mismo reutilizando `JWTAuthentication`, sin duplicar lógica de firma/validación.
"""
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

RUTAS_EXENTAS = {
    "/api/auth/login/",
    "/api/auth/verify-otp/",
    "/api/auth/refresh/",
    "/api/auth/me/",
    "/api/auth/change-password/",
}


class ForzarCambioPasswordMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def __call__(self, request):
        if request.path not in RUTAS_EXENTAS:
            try:
                resultado = self.jwt_auth.authenticate(request)
            except Exception:  # noqa: BLE001
                resultado = None
            if resultado:
                user, _ = resultado
                if getattr(user, "debe_cambiar_password", False):
                    return JsonResponse(
                        {
                            "success": False,
                            "message": "Debes cambiar tu contraseña antes de continuar.",
                            "debe_cambiar_password": True,
                        },
                        status=403,
                    )
        return self.get_response(request)
