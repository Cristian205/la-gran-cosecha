"""
Permisos de la API, ya acotados al negocio.

Hasta la fase 3 esto se apoyaba en el `user_permissions` nativo de Django. Era
elegante para un solo negocio y un agujero con dos: ese `user_permissions` es
global, no puede expresar «edita productos en La Gran Cosecha pero no en la
perfumería», y `is_staff` bastaba para pasar cualquier verificación de
cualquier negocio. Ahora todo se resuelve contra la `Membership` del usuario en
el negocio de la petición.

`is_superuser` sigue saltándose las comprobaciones de permiso, pero NO el
ámbito de datos: un superusuario dentro de un negocio ve ese negocio y nada
más. Atravesar negocios exige `ambito_de_plataforma()`, que es explícito y vive
en el panel de plataforma.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def pertenencia_actual(request):
    """
    La `Membership` del usuario en el negocio de esta petición, o None.

    Devuelve None también cuando no hay negocio resuelto: sin saber en qué
    negocio estamos no se puede conceder nada.
    """
    usuario = getattr(request, "user", None)
    tenant = getattr(request, "tenant", None)
    if not (usuario and usuario.is_authenticated) or tenant is None:
        return None

    from apps.tenancy.models import Membership  # noqa: PLC0415

    return Membership.objects.filter(
        usuario=usuario, tenant=tenant, activo=True
    ).first()


def es_owner(request) -> bool:
    """
    El dueño de la cuenta tiene acceso total dentro de su negocio.

    Los permisos granulares existen para delegar en terceros, no para
    restringir a quien paga la cuenta — misma semántica que antes, ahora
    limitada a un negocio.
    """
    usuario = getattr(request, "user", None)
    if usuario is not None and usuario.is_superuser:
        return True
    pertenencia = pertenencia_actual(request)
    return bool(pertenencia and pertenencia.tiene_acceso_total)


def es_owner_de(usuario, tenant) -> bool:
    """
    ¿Este usuario concreto es dueño de este negocio concreto?

    Variante de `es_owner()` para cuando se pregunta por alguien que no es
    quien hace la petición — al listar el equipo, o al impedir que un delegado
    edite al dueño.
    """
    if usuario is None or not usuario.is_authenticated:
        return False
    if usuario.is_superuser:
        return True
    if tenant is None:
        return False

    from apps.tenancy.models import Membership  # noqa: PLC0415

    pertenencia = Membership.objects.filter(
        usuario=usuario, tenant=tenant, activo=True
    ).first()
    return bool(pertenencia and pertenencia.tiene_acceso_total)


def permisos_de(usuario, tenant):
    """Los codenames que este usuario tiene concedidos en este negocio."""
    from apps.tenancy.models import Membership  # noqa: PLC0415

    if tenant is None:
        return []
    pertenencia = Membership.objects.filter(
        usuario=usuario, tenant=tenant, activo=True
    ).first()
    return list(pertenencia.permisos or []) if pertenencia else []


class EsStaff(BasePermission):
    """Usuario del panel que además trabaja en este negocio."""

    def has_permission(self, request, view):
        usuario = request.user
        if not (usuario and usuario.is_authenticated and usuario.is_staff):
            return False
        return usuario.is_superuser or pertenencia_actual(request) is not None


class EsAdministrador(BasePermission):
    """Dueño o administrador del negocio de la petición."""

    def has_permission(self, request, view):
        return es_owner(request)


class SoloLecturaPublicaOStaff(BasePermission):
    """
    Lectura pública para la tienda; escritura solo para quien trabaja en el
    negocio.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return EsStaff().has_permission(request, view)


def requiere_permiso(codename: str):
    """
    Fábrica de permiso DRF: exige trabajar en este negocio y tener el permiso.

    El codename mantiene el formato de siempre ('catalog.change_producto') y el
    catálogo curado de `accounts/permisos.py` sigue sirviendo tal cual. Lo que
    cambia es dónde se busca: en `Membership.permisos`, que está atado al
    negocio, en vez de en el `user_permissions` del usuario, que no lo está.
    """

    class _RequierePermiso(BasePermission):
        def has_permission(self, request, view):
            usuario = request.user
            if not (usuario and usuario.is_authenticated and usuario.is_staff):
                return False
            if usuario.is_superuser:
                return True

            pertenencia = pertenencia_actual(request)
            if pertenencia is None:
                return False
            return pertenencia.tiene_permiso(codename)

    return _RequierePermiso
