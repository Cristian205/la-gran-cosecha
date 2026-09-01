"""
El panel de Crynex: planes, permisos y negocios.

Es la única parte del sistema que atraviesa negocios a propósito, así que es
también donde más importa comprobar quién entra: administrar un negocio no
puede dar acceso a los planes de todos los clientes.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.billing.models import Plan
from apps.tenancy.models import Tenant

pytestmark = pytest.mark.django_db

RUTAS = [
    "/api/platform/resumen/",
    "/api/platform/tenants/",
    "/api/platform/plans/",
    "/api/platform/permissions/",
]


@pytest.fixture
def staff_plataforma(negocio):
    usuario = get_user_model().objects.create_user(
        email_usuario="crynex@ejemplo.test",
        nombre_usuario="Equipo Crynex",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    usuario.es_staff_plataforma = True
    usuario.save(update_fields=["es_staff_plataforma"])

    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


def codenames_visibles(cliente):
    """Los permisos que un negocio puede repartir, aplanados."""
    return {
        permiso["codename"]
        for modulo in cliente.get("/api/auth/permisos-disponibles/").json()
        for permiso in modulo["permisos"]
    }


# ==========================================================================
# QUIÉN ENTRA
# ==========================================================================
@pytest.mark.parametrize("ruta", RUTAS)
def test_el_staff_de_plataforma_entra(staff_plataforma, ruta):
    assert staff_plataforma.get(ruta).status_code == 200


@pytest.mark.parametrize("ruta", RUTAS)
def test_administrar_un_negocio_no_da_acceso_a_la_plataforma(api_owner, ruta):
    """
    La separación del punto 9. `api_owner` es dueña de SU negocio y aun así no
    puede ver los planes de los demás ni cambiarlos.
    """
    assert api_owner.get(ruta).status_code == 403


@pytest.mark.parametrize("ruta", RUTAS)
def test_un_visitante_no_ve_nada(api, ruta):
    assert api.get(ruta).status_code in (401, 403)


def test_ser_superusuario_de_django_no_basta(negocio):
    """
    Deliberado: en esta instalación cuatro de las cinco cuentas son
    superusuarias por herencia, y tocar los planes de todos los clientes tiene
    que ser una decisión explícita, no un efecto secundario de un flag viejo.
    """
    superusuario = get_user_model().objects.create_superuser(
        email_usuario="super@ejemplo.test",
        nombre_usuario="Superusuario heredado",
        password="clave-de-prueba-123",
    )
    cliente = APIClient()
    cliente.force_authenticate(user=superusuario)

    assert cliente.get("/api/platform/plans/").status_code == 403


# ==========================================================================
# LA MATRIZ: PLANES x PERMISOS
# ==========================================================================
def test_el_catalogo_se_sembro_desde_el_que_ya_existia(staff_plataforma):
    """No se inventaron permisos: salen de accounts/permisos.py."""
    from apps.accounts.permisos import TODOS_LOS_CODENAMES

    respuesta = staff_plataforma.get("/api/platform/permissions/").json()
    assert {p["codename"] for p in respuesta} == TODOS_LOS_CODENAMES


def test_los_tres_planes_de_arranque_existen(staff_plataforma):
    planes = staff_plataforma.get("/api/platform/plans/").json()
    assert {p["slug"] for p in planes} == {"starter", "growth", "business"}
    # Exactamente uno recibe a los negocios nuevos.
    assert sum(1 for p in planes if p["es_predeterminado"]) == 1


def test_un_plan_no_puede_conceder_un_permiso_que_no_existe(staff_plataforma):
    """
    Un codename inventado no concedería nada y sería invisible hasta que
    alguien se preguntara por qué un plan no funciona.
    """
    plan = Plan.objects.get(slug="starter")
    respuesta = staff_plataforma.patch(
        f"/api/platform/plans/{plan.id}/",
        {"permisos": ["catalog.view_producto", "modulo.inventado"]},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "modulo.inventado" in str(respuesta.json())


def test_retirar_un_permiso_lo_oculta_en_todos_los_negocios(
    api_owner, negocio, staff_plataforma
):
    """
    El sentido de tener el catálogo en la base: Crynex desactiva un módulo y
    desaparece de todas las empresas sin tocar ningún plan.
    """
    catalogo = staff_plataforma.get("/api/platform/permissions/").json()
    objetivo = next(p for p in catalogo if p["codename"] == "catalog.view_producto")

    assert "catalog.view_producto" in codenames_visibles(api_owner)

    staff_plataforma.patch(
        f"/api/platform/permissions/{objetivo['id']}/", {"activo": False}, format="json"
    )

    assert "catalog.view_producto" not in codenames_visibles(api_owner)


def test_cada_negocio_ve_solo_lo_que_su_plan_incluye(api_owner, negocio):
    """
    Antes el catálogo era idéntico para todos. Ahora un negocio en Starter no
    ve siquiera la opción de conceder "editar productos".
    """
    negocio.suscripcion.plan = Plan.objects.get(slug="starter")
    negocio.suscripcion.save(update_fields=["plan"])

    codenames = codenames_visibles(api_owner)
    assert "catalog.view_producto" in codenames
    assert "catalog.change_producto" not in codenames


def test_un_negocio_sin_suscripcion_no_reparte_nada(api_owner, negocio):
    """Preferible un panel vacío a repartir permisos que nadie ha contratado."""
    negocio.suscripcion.delete()
    assert api_owner.get("/api/auth/permisos-disponibles/").json() == []


# ==========================================================================
# NEGOCIOS Y PLANES
# ==========================================================================
def test_la_plataforma_ve_todos_los_negocios(staff_plataforma, negocio):
    otro = Tenant.objects.create(slug="otra", nombre="Otra empresa", estado="ACTIVO")

    slugs = {n["slug"] for n in staff_plataforma.get("/api/platform/tenants/").json()}
    assert {negocio.slug, otro.slug} <= slugs


def test_se_puede_mover_una_empresa_de_plan(staff_plataforma, negocio):
    respuesta = staff_plataforma.post(
        f"/api/platform/tenants/{negocio.id}/cambiar-plan/",
        {"plan": "growth"},
        format="json",
    )
    assert respuesta.status_code == 200

    # Se relee desde la base y no desde la relación en memoria, que sigue
    # apuntando al plan anterior.
    from apps.billing.models import Subscription

    assert Subscription.objects.get(tenant=negocio).plan.slug == "growth"


def test_un_plan_con_empresas_dentro_no_se_borra(staff_plataforma, negocio):
    """
    Borrarlo dejaría a esos negocios sin plan y sin permisos de un golpe. Se
    desactiva, que es lo que de verdad se quiere decir.
    """
    plan = negocio.suscripcion.plan
    staff_plataforma.delete(f"/api/platform/plans/{plan.id}/")

    plan.refresh_from_db()
    assert plan.activo is False


def test_un_negocio_nuevo_nace_con_el_plan_por_defecto(negocio):
    """
    Sin suscripción, una empresa recién dada de alta no podría repartir ni un
    permiso entre su gente, y el alta quedaría a medias sin que nadie
    entendiera por qué.

    (A los negocios que ya existían antes de haber planes los sube al plan más
    alto la migración `billing.0002`: llevaban meses usando el sistema entero y
    recortarles el acceso al desplegar sería quitarles algo que ya tenían.)
    """
    assert negocio.suscripcion.plan.slug == "starter"
    assert negocio.suscripcion.estado == "PRUEBA"


def test_los_limites_se_pueden_pactar_por_empresa(negocio):
    """Evita inventar un plan nuevo para un solo cliente que negoció algo."""
    suscripcion = negocio.suscripcion
    assert suscripcion.limite("max_usuarios") == 2  # lo que da Starter

    suscripcion.limites_extra = {"max_usuarios": 50}
    suscripcion.save(update_fields=["limites_extra"])
    assert suscripcion.limite("max_usuarios") == 50
