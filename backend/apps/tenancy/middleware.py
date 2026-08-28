"""
Resolución del tenant de cada petición.

Tres fuentes, en orden de prioridad:

1. El claim `tenant_id` del JWT — el panel administrativo. Va firmado, así que
   no se puede manipular desde el cliente, y evita una consulta por petición.
   La fase 4 es la que lo emite; aquí ya se lee para no tener que volver.
2. El `Host` de la petición contra `Domain` — la tienda pública, donde el
   visitante es anónimo y el dominio es la única señal disponible.
3. La cabecera `X-Tenant` con el slug — solo si `TENANCY_ACEPTA_CABECERA` está
   activo (desarrollo y tests). En producción va apagada: sin la comprobación
   de pertenencia que trae la fase 4, sería un cambio de negocio a voluntad.

Cuando NO resuelve ningún negocio, el middleware deja el contexto SIN DECLARAR
en vez de declararlo vacío. La diferencia es la que separa el fallo cerrado del
abierto: un contexto vacío significa «ámbito de plataforma, sin filtro», que es
justo lo que no debe pasar por accidente en una petición de la API. Sin ámbito
declarado, cualquier consulta a un modelo de negocio lanza, y las vistas lo
convierten en 404 antes de llegar ahí.
"""
import logging

from django.conf import settings
from django.core.cache import cache

from .context import establecer_tenant, limpiar_ambito, restablecer
from .db import declarar_tenant_en_la_base
from .models import Domain, Tenant

logger = logging.getLogger(__name__)

# El mapa hostname→tenant cambia muy poco y se consulta en cada petición.
CACHE_SEGUNDOS = 300
CACHE_PREFIJO = "tenancy:dominio:"


class TenantMiddleware:
    """
    Deja resuelto `request.tenant` y el contexto para los managers.

    Va antes que cualquier middleware que consulte datos de negocio, y después
    de `CommonMiddleware`, que es quien normaliza el host.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._jwt = None  # se instancia perezosamente: ver _tenant_del_jwt

    def __call__(self, request):
        tenant = self._resolver(request)
        request.tenant = tenant

        # Se fija SIEMPRE, incluso para dejarlo sin declarar: un ámbito heredado
        # de más arriba en la pila seguiría vigente dentro de la petición, y una
        # petición que no resolvió negocio devolvería datos en vez de fallar.
        token = limpiar_ambito() if tenant is None else establecer_tenant(tenant)

        # La misma decisión, dicha también a PostgreSQL: es lo que alimenta la
        # política de RLS, la capa que sigue en pie cuando el ORM falla.
        declarar_tenant_en_la_base(tenant)
        try:
            return self.get_response(request)
        finally:
            # En un worker con hilos el contexto se reutiliza entre peticiones;
            # sin este reset, el tenant de una se filtraría a la siguiente.
            restablecer(token)

    # ------------------------------------------------------------------
    def _resolver(self, request):
        for fuente in (self._tenant_del_jwt, self._tenant_del_host, self._tenant_de_cabecera):
            tenant = fuente(request)
            if tenant is not None:
                # Un negocio suspendido resuelve a "sin tenant", no a sus datos.
                if not tenant.esta_operativo:
                    logger.warning(
                        "Petición a %s, que está %s", tenant.slug, tenant.estado
                    )
                    return None
                return tenant
        return None

    def _tenant_del_jwt(self, request):
        """
        Lee el claim sin validar sesión: a esta altura `request.user` todavía no
        está resuelto (DRF autentica dentro de la vista). Se reutiliza
        `JWTAuthentication` para no duplicar la lógica de firma, igual que hace
        `ForzarCambioPasswordMiddleware`.
        """
        cabecera = request.META.get("HTTP_AUTHORIZATION", "")
        if not cabecera.startswith("Bearer "):
            return None

        if self._jwt is None:
            from rest_framework_simplejwt.authentication import JWTAuthentication

            self._jwt = JWTAuthentication()

        try:
            validado = self._jwt.get_validated_token(cabecera.split()[1])
        except Exception:  # noqa: BLE001 — token inválido o caducado: no es aquí
            return None                # donde se responde 401, eso es cosa de DRF

        uuid_tenant = validado.get("tenant_id")
        if not uuid_tenant:
            return None
        return Tenant.objects.filter(uuid=uuid_tenant).first()

    def _tenant_del_host(self, request):
        hostname = request.get_host().split(":")[0].lower()
        if not hostname:
            return None

        clave = f"{CACHE_PREFIJO}{hostname}"
        id_tenant = cache.get(clave)

        if id_tenant is None:
            dominio = (
                Domain.objects.filter(hostname=hostname, verificado=True)
                .select_related("tenant")
                .first()
            )
            # Se cachea también la ausencia (0): un host desconocido que reciba
            # tráfico no debe golpear la base en cada petición.
            id_tenant = dominio.tenant_id if dominio else 0
            cache.set(clave, id_tenant, CACHE_SEGUNDOS)
            if dominio:
                return dominio.tenant

        if not id_tenant:
            return None
        return Tenant.objects.filter(pk=id_tenant).first()

    def _tenant_de_cabecera(self, request):
        if not getattr(settings, "TENANCY_ACEPTA_CABECERA", False):
            return None
        slug = request.META.get("HTTP_X_TENANT", "").strip().lower()
        if not slug:
            return None

        # Aquí solo se resuelve el candidato. Que quien llama tenga derecho a
        # ese negocio lo comprueba `ExigePertenencia` en la vista: a esta
        # altura `request.user` todavía es anónimo con JWT, porque DRF
        # autentica dentro de la vista, no en el middleware.
        return Tenant.objects.filter(slug=slug).first()


def limpiar_cache_de_dominio(hostname: str) -> None:
    """Invalida un hostname tras crear, mover o borrar su `Domain`."""
    cache.delete(f"{CACHE_PREFIJO}{hostname.strip().lower()}")
