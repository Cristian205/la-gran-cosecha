from rest_framework.permissions import BasePermission, SAFE_METHODS


class EsStaff(BasePermission):
    """Permite el acceso solo a usuarios autenticados con is_staff=True."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class EsAdministrador(BasePermission):
    """
    Equivale a la función `es_administrador` del proyecto original:
    solo GERENTE o superusuario.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (getattr(user, "rol_usuario", None) == "GERENTE" or user.is_superuser)
        )


class SoloLecturaPublicaOStaff(BasePermission):
    """
    Lectura (GET/HEAD/OPTIONS) pública para el storefront;
    escritura solo para staff autenticado.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


def es_owner(user) -> bool:
    """
    El 'dueño' (GERENTE o superusuario) siempre tiene acceso total: los permisos
    granulares por usuario existen para delegar en terceros, no para restringir
    al dueño de la cuenta.
    """
    return bool(user and (user.is_superuser or getattr(user, "rol_usuario", None) == "GERENTE"))


def requiere_permiso(codename: str):
    """
    Fábrica de permiso DRF: exige estar autenticado y ser staff, y además
    (salvo que sea el dueño) tener el permiso Django puntual indicado
    (formato 'app_label.codename', ej. 'catalog.delete_producto').

    Permite construir permisos por acción/por usuario sin inventar un modelo
    nuevo: se apoya en el `user_permissions` que Django ya trae de fábrica.
    """

    class _RequierePermiso(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated and user.is_staff):
                return False
            if es_owner(user):
                return True
            return user.has_perm(codename)

    return _RequierePermiso
