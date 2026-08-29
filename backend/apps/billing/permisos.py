"""Quién puede administrar Crynex."""
from rest_framework.permissions import BasePermission


class EsStaffDePlataforma(BasePermission):
    """
    Solo quien administra la plataforma, no quien administra un negocio.

    Es la separación del punto 9 del plan. Deliberadamente NO basta con
    `is_superuser`: ese es un permiso de Django que en esta instalación tienen
    cuatro de las cinco cuentas por herencia, y tocar los planes de todos los
    clientes tiene que ser una decisión explícita, no un efecto secundario.
    """

    message = "Esta sección es de la administración de Crynex."

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and usuario.is_active
            and getattr(usuario, "es_staff_plataforma", False)
        )
