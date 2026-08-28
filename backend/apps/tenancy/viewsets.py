"""
Capa 2 de las tres del aislamiento: la vista.

Duplica a propósito lo que ya hace el manager. No es redundancia inútil: el
manager se elude con `.raw()`, con un `get_queryset()` sobrescrito o con un
`Manager` distinto declarado en el modelo, y esta capa sigue en pie. La tercera
—la RLS de PostgreSQL— cubre lo que se le escape a las dos.

Lo que aporta aquí que el manager no puede:

* asignar el tenant al crear, sin aceptarlo nunca del cuerpo de la petición;
* convertir "objeto de otro negocio" en un 404 y no en un 403.
"""
from rest_framework.exceptions import NotFound

from .context import obtener_tenant_actual


class TenantScopedMixin:
    """
    Para mezclar con cualquier `ViewSet` de DRF que exponga datos de negocio.

    A partir de la fase 3 se aplica a los ViewSets existentes de catalog,
    orders, content, media y notifications.
    """

    def obtener_tenant(self):
        """
        El tenant de esta petición, o 404 si no hay ninguno.

        404 y no 400: la ausencia de tenant significa que el host no resuelve a
        ningún negocio, y en ese caso el recurso sencillamente no existe.
        """
        tenant = getattr(self.request, "tenant", None) or obtener_tenant_actual()
        if tenant is None:
            raise NotFound("No hay ningún negocio asociado a esta dirección.")
        return tenant

    def get_queryset(self):
        """
        Vuelve a acotar lo que el manager ya acotó.

        Si alguien declara `queryset = Producto.all_tenants.all()` en una vista
        —por comodidad al depurar, y se le olvida—, este filtro lo rescata.
        """
        qs = super().get_queryset()
        modelo = qs.model
        if not _tiene_tenant(modelo):
            return qs
        return qs.filter(tenant=self.obtener_tenant())

    def perform_create(self, serializer):
        """
        El tenant lo pone el servidor, siempre.

        Nunca `serializer.validated_data["tenant"]`: aceptar el tenant del
        cuerpo es asignación masiva, y es el primer sitio donde alguien
        intentaría escribir en el negocio del vecino.
        """
        if _tiene_tenant(serializer.Meta.model):
            serializer.save(tenant=self.obtener_tenant())
        else:
            serializer.save()

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        contexto["tenant"] = getattr(self.request, "tenant", None)
        return contexto


def _tiene_tenant(modelo) -> bool:
    return any(campo.name == "tenant" for campo in modelo._meta.fields)
