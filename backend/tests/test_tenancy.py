"""
Fase 1: los cimientos multiempresa.

Va en la suite verde (sin marcador `tenancy`) porque prueba lo que esta fase
construye, no lo que falta. La suite roja de `test_aislamiento.py` sigue en su
sitio describiendo las fases 2 y 3.

El criterio de salida de la fase es concreto: se crean dos negocios y el
middleware los distingue por dominio.
"""
import pytest
from django.core.cache import cache
from django.db import IntegrityError, transaction

from apps.tenancy.context import (
    SinTenantEnContexto,
    ambito_de_plataforma,
    hay_ambito_declarado,
    obtener_tenant_actual,
    usar_tenant,
)
from apps.tenancy.models import Domain, Membership, Tenant
from tests.soporte.models import Cosa

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _cache_limpia():
    """El mapa dominio→tenant se cachea 5 min; entre tests debe estar frío."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def negocios():
    """Los dos negocios del criterio de salida."""
    cosecha = Tenant.objects.create(
        slug="la-gran-cosecha", nombre="La Gran Cosecha", estado="ACTIVO"
    )
    perfumeria = Tenant.objects.create(
        slug="perfumeria-xyz", nombre="Perfumería XYZ", estado="ACTIVO"
    )
    Domain.objects.create(
        tenant=cosecha, hostname="la-gran-cosecha.plataforma.test", es_primario=True
    )
    Domain.objects.create(
        tenant=perfumeria, hostname="perfumeria.plataforma.test", es_primario=True
    )
    return cosecha, perfumeria


# ==========================================================================
# MODELOS
# ==========================================================================
def test_cada_negocio_recibe_un_uuid_estable(negocios):
    """Es el identificador de las rutas en R2: el slug se renombra, este no."""
    cosecha, perfumeria = negocios
    assert cosecha.uuid != perfumeria.uuid

    slug_viejo = cosecha.slug
    cosecha.slug = "cosecha-renombrada"
    cosecha.save()
    cosecha.refresh_from_db()

    assert cosecha.slug != slug_viejo
    assert cosecha.uuid  # sobrevive al renombrado


def test_el_hostname_se_normaliza_a_minusculas(negocios):
    cosecha, _ = negocios
    dominio = Domain.objects.create(tenant=cosecha, hostname="  WWW.Cosecha.COM  ")
    assert dominio.hostname == "www.cosecha.com"


def test_un_negocio_no_puede_tener_dos_dominios_primarios(negocios):
    """Si no, la URL canónica del SEO quedaría ambigua."""
    cosecha, _ = negocios
    with pytest.raises(IntegrityError), transaction.atomic():
        Domain.objects.create(
            tenant=cosecha, hostname="otro.plataforma.test", es_primario=True
        )


def test_dos_negocios_si_pueden_tener_su_propio_primario(negocios):
    cosecha, perfumeria = negocios
    assert cosecha.dominios.filter(es_primario=True).count() == 1
    assert perfumeria.dominios.filter(es_primario=True).count() == 1


def test_un_hostname_no_se_puede_repetir_entre_negocios(negocios):
    _, perfumeria = negocios
    with pytest.raises(IntegrityError), transaction.atomic():
        Domain.objects.create(
            tenant=perfumeria, hostname="la-gran-cosecha.plataforma.test"
        )


def test_un_negocio_suspendido_no_esta_operativo(negocios):
    cosecha, _ = negocios
    cosecha.estado = "SUSPENDIDO"
    assert cosecha.esta_operativo is False


# ==========================================================================
# PERTENENCIA Y PERMISOS
# ==========================================================================
def test_una_persona_puede_pertenecer_a_dos_negocios(negocios):
    """Decisión B: `Usuario` es identidad de plataforma, no de un negocio."""
    from django.contrib.auth import get_user_model

    cosecha, perfumeria = negocios
    # Usuario propio del test: los fixtures compartidos ya vienen dados de alta
    # en su negocio, y aquí interesa contar desde cero.
    contadora = get_user_model().objects.create_user(
        email_usuario="contadora@ejemplo.test",
        nombre_usuario="Contadora externa",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    Membership.objects.create(usuario=contadora, tenant=cosecha, rol="OWNER")
    Membership.objects.create(usuario=contadora, tenant=perfumeria, rol="STAFF")

    assert contadora.memberships.count() == 2


def test_no_puede_haber_dos_pertenencias_al_mismo_negocio(negocios, usuario_owner):
    cosecha, _ = negocios
    Membership.objects.create(usuario=usuario_owner, tenant=cosecha, rol="OWNER")
    with pytest.raises(IntegrityError), transaction.atomic():
        Membership.objects.create(usuario=usuario_owner, tenant=cosecha, rol="STAFF")


@pytest.mark.parametrize("rol", ["OWNER", "ADMIN"])
def test_el_dueno_y_el_admin_no_necesitan_permisos_explicitos(
    negocios, usuario_owner, rol
):
    """Conserva la semántica del `es_owner()` actual, ya acotada al negocio."""
    cosecha, _ = negocios
    pertenencia = Membership.objects.create(
        usuario=usuario_owner, tenant=cosecha, rol=rol, permisos=[]
    )
    assert pertenencia.tiene_permiso("catalog.change_producto") is True


def test_el_personal_solo_tiene_los_permisos_que_se_le_dan(negocios, usuario_staff):
    cosecha, _ = negocios
    pertenencia = Membership.objects.create(
        usuario=usuario_staff,
        tenant=cosecha,
        rol="STAFF",
        permisos=["catalog.view_producto"],
    )
    assert pertenencia.tiene_permiso("catalog.view_producto") is True
    assert pertenencia.tiene_permiso("catalog.delete_producto") is False


def test_una_pertenencia_inactiva_no_concede_nada(negocios, usuario_owner):
    """Dar de baja a alguien tiene que cortar incluso siendo dueño."""
    cosecha, _ = negocios
    pertenencia = Membership.objects.create(
        usuario=usuario_owner, tenant=cosecha, rol="OWNER", activo=False
    )
    assert pertenencia.tiene_permiso("catalog.change_producto") is False


# ==========================================================================
# CONTEXTO — la pieza de la que depende el manager
# ==========================================================================
def test_sin_ambito_declarado_consultar_es_un_error(negocios):
    """
    El comportamiento central del diseño: fallar cerrado. Sin esto, un
    `Cosa.objects.all()` olvidado devolvería las filas de todos los negocios.
    """
    assert hay_ambito_declarado() is False
    with pytest.raises(SinTenantEnContexto):
        list(Cosa.objects.all())


def test_dentro_de_un_negocio_solo_se_ven_sus_filas(negocios):
    cosecha, perfumeria = negocios
    Cosa.all_tenants.create(tenant=cosecha, nombre="Mango")
    Cosa.all_tenants.create(tenant=perfumeria, nombre="Perfume floral")

    with usar_tenant(cosecha):
        assert [c.nombre for c in Cosa.objects.all()] == ["Mango"]

    with usar_tenant(perfumeria):
        assert [c.nombre for c in Cosa.objects.all()] == ["Perfume floral"]


def test_el_ambito_de_plataforma_atraviesa_todos_los_negocios(negocios):
    cosecha, perfumeria = negocios
    Cosa.all_tenants.create(tenant=cosecha, nombre="Mango")
    Cosa.all_tenants.create(tenant=perfumeria, nombre="Perfume floral")

    with ambito_de_plataforma():
        assert Cosa.objects.count() == 2
        assert obtener_tenant_actual() is None


def test_la_escotilla_all_tenants_no_necesita_contexto(negocios):
    """Para migraciones, comandos y el panel de plataforma."""
    cosecha, _ = negocios
    Cosa.all_tenants.create(tenant=cosecha, nombre="Mango")

    assert hay_ambito_declarado() is False
    assert Cosa.all_tenants.count() == 1  # no lanza


def test_el_ambito_se_restaura_al_salir(negocios):
    """Un contexto que no se restaura filtra el tenant a la siguiente petición."""
    cosecha, perfumeria = negocios
    with usar_tenant(cosecha):
        with usar_tenant(perfumeria):
            assert obtener_tenant_actual() == perfumeria
        assert obtener_tenant_actual() == cosecha
    assert hay_ambito_declarado() is False


def test_recorrer_una_clave_foranea_no_depende_del_contexto(negocios):
    """
    `base_manager_name = "all_tenants"`: Django usa el manager base para
    resolver relaciones y cascadas. Si dependiera del contexto, un
    `cosa.tenant` dentro de una tarea de fondo reventaría.
    """
    cosecha, _ = negocios
    cosa = Cosa.all_tenants.create(tenant=cosecha, nombre="Mango")

    assert hay_ambito_declarado() is False
    assert cosa.tenant.nombre == "La Gran Cosecha"  # no lanza


def test_el_tenant_no_se_puede_asignar_desde_un_formulario():
    """`editable=False`: ni ModelForm ni ModelSerializer lo exponen."""
    assert Cosa._meta.get_field("tenant").editable is False


# ==========================================================================
# MIDDLEWARE — el criterio de salida de la fase
# ==========================================================================
def test_el_middleware_distingue_los_negocios_por_dominio(api, negocios):
    """
    Criterio de salida: dos negocios, y el middleware sabe cuál es cuál por el
    host. Se comprueba sobre una ruta pública real, no sobre una de juguete.
    """
    cosecha, perfumeria = negocios

    respuesta = api.get(
        "/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test"
    )
    assert respuesta.wsgi_request.tenant == cosecha

    respuesta = api.get(
        "/api/content/site-config/", HTTP_HOST="perfumeria.plataforma.test"
    )
    assert respuesta.wsgi_request.tenant == perfumeria


def test_un_host_desconocido_resuelve_a_ningun_negocio(api, negocios):
    respuesta = api.get("/api/content/site-config/", HTTP_HOST="inventado.test")
    assert respuesta.wsgi_request.tenant is None


def test_el_puerto_no_estorba_a_la_resolucion(api, negocios):
    cosecha, _ = negocios
    respuesta = api.get(
        "/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test:8000"
    )
    assert respuesta.wsgi_request.tenant == cosecha


def test_un_dominio_sin_verificar_no_resuelve(api, negocios):
    """Un dominio propio no sirve tráfico hasta que se comprueba su TXT."""
    cosecha, _ = negocios
    Domain.objects.create(
        tenant=cosecha, hostname="sin-verificar.test", verificado=False
    )
    respuesta = api.get("/api/content/site-config/", HTTP_HOST="sin-verificar.test")
    assert respuesta.wsgi_request.tenant is None


def test_un_negocio_suspendido_no_resuelve(api, negocios):
    cosecha, _ = negocios
    cosecha.estado = "SUSPENDIDO"
    cosecha.save()

    respuesta = api.get(
        "/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test"
    )
    assert respuesta.wsgi_request.tenant is None


def test_la_cabecera_x_tenant_elige_el_negocio_en_pruebas(api, negocios):
    _, perfumeria = negocios
    respuesta = api.get("/api/content/site-config/", HTTP_X_TENANT="perfumeria-xyz")
    assert respuesta.wsgi_request.tenant == perfumeria


def test_la_cabecera_x_tenant_se_ignora_si_esta_desactivada(api, negocios, settings):
    """En producción va apagada: sin comprobar pertenencia sería un agujero."""
    settings.TENANCY_ACEPTA_CABECERA = False
    respuesta = api.get("/api/content/site-config/", HTTP_X_TENANT="perfumeria-xyz")
    assert respuesta.wsgi_request.tenant is None


def test_el_dominio_gana_a_la_cabecera(api, negocios):
    """La tienda pública se sirve por dominio; la cabecera es el último recurso."""
    cosecha, _ = negocios
    respuesta = api.get(
        "/api/content/site-config/",
        HTTP_HOST="la-gran-cosecha.plataforma.test",
        HTTP_X_TENANT="perfumeria-xyz",
    )
    assert respuesta.wsgi_request.tenant == cosecha


def test_mover_un_dominio_surte_efecto_de_inmediato(api, negocios):
    """
    Sin invalidar el caché, un traslado entre negocios serviría el catálogo
    equivocado hasta cinco minutos.
    """
    cosecha, perfumeria = negocios
    api.get("/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test")

    dominio = Domain.objects.get(hostname="la-gran-cosecha.plataforma.test")
    dominio.es_primario = False
    dominio.tenant = perfumeria
    dominio.save()

    respuesta = api.get(
        "/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test"
    )
    assert respuesta.wsgi_request.tenant == perfumeria


def test_el_contexto_no_sobrevive_a_la_peticion(api, negocios):
    """Un contexto sin restaurar filtraría el negocio a la petición siguiente."""
    api.get("/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test")
    assert hay_ambito_declarado() is False


def test_sin_ningun_negocio_dado_de_alta_no_hay_tienda(api):
    """
    Cambió respecto a la fase 1, y a propósito.

    Entonces esta ruta devolvía 200 sin negocio porque `SiteConfig` era un
    singleton que existía siempre. Ahora la configuración pertenece a un
    negocio, así que sin ninguno dado de alta no hay tienda que servir y la
    respuesta correcta es 404. Producción nunca ve este caso: la migración de
    datos crea La Gran Cosecha antes de que la aplicación arranque.
    """
    assert api.get("/api/content/site-config/").status_code == 404


def test_con_un_solo_negocio_la_tienda_sirve_aunque_el_host_no_resuelva(api, negocios):
    """
    El puente de la fase 2. Los hostnames de producción todavía no están dados
    de alta como `Domain`, así que sin este comportamiento el despliegue de
    esta fase dejaría la tienda sin identidad. Deja de aplicar en cuanto hay
    un segundo negocio, que es justo cuando adivinar sería peligroso.
    """
    Tenant.objects.filter(slug="perfumeria-xyz").delete()  # queda uno solo

    respuesta = api.get("/api/content/site-config/", HTTP_HOST="host-no-dado-de-alta.test")
    assert respuesta.status_code == 200


def test_con_dos_negocios_deja_de_adivinar(api, negocios):
    """Servir la identidad del negocio equivocado es peor que no servir ninguna."""
    respuesta = api.get("/api/content/site-config/", HTTP_HOST="host-no-dado-de-alta.test")
    assert respuesta.status_code == 404
