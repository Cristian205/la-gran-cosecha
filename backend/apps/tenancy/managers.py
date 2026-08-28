"""
Capa 1 de las tres del aislamiento: el manager por defecto.

La idea es que filtrar por tenant sea lo que pasa cuando NO se piensa en ello.
`Producto.objects.all()` devuelve el catálogo del tenant activo porque es el
manager por defecto quien lo acota, no porque cada vista se acuerde de añadir
un `.filter(tenant=...)`.

Las otras dos capas (el ViewSet base y la RLS de PostgreSQL) existen porque
esta se puede eludir: `.raw()`, un `Manager` sobrescrito, una consulta con
`.extra()`. Ninguna capa se basta sola.
"""
from django.db import models

from .context import SinTenantEnContexto, hay_ambito_declarado, obtener_tenant_actual


class TenantQuerySet(models.QuerySet):
    def del_tenant(self, tenant):
        """Filtra por un tenant explícito, ignorando el contexto."""
        return self.filter(tenant=tenant)


class TenantManager(models.Manager.from_queryset(TenantQuerySet)):
    """
    Manager por defecto de todo modelo con ámbito de tenant.

    Fallar cerrado es deliberado: sin ámbito declarado lanza en lugar de
    devolver todas las filas. Un `RuntimeError` ruidoso en desarrollo es
    infinitamente preferible a una fuga silenciosa en producción.
    """

    def get_queryset(self):
        qs = super().get_queryset()

        if not hay_ambito_declarado():
            raise SinTenantEnContexto(
                f"{self.model.__name__} se consultó sin tenant en el contexto. "
                f"Usa `with usar_tenant(t):`, o `{self.model.__name__}."
                f"all_tenants` si de verdad quieres atravesar todos los "
                f"negocios (y deja claro en el código por qué)."
            )

        tenant = obtener_tenant_actual()
        if tenant is None:
            # Ámbito de plataforma declarado a propósito: sin filtro.
            return qs
        return qs.filter(tenant=tenant)


class ManagerSinAmbito(models.Manager.from_queryset(TenantQuerySet)):
    """
    Escotilla explícita: atraviesa todos los tenants, siempre.

    Se expone como `Modelo.all_tenants` y su nombre es feo a propósito — tiene
    que cantar en una revisión de código. Usos legítimos: el panel de
    plataforma, las migraciones de datos, los comandos de gestión y el propio
    middleware, que necesita resolver el `Domain` antes de saber qué tenant hay.

    También es el `base_manager_name` de los modelos con tenant, para que el
    recorrido de claves foráneas (`pedido.cliente`) y los borrados en cascada
    de Django no dependan del contexto de la petición.
    """
