"""
Fase 4: la sesión sabe en qué negocio estás.

El negocio activo viaja firmado dentro del JWT. El claim solo ELIGE; no
concede: la pertenencia se comprueba en cada petición, así que dar de baja a
alguien surte efecto de inmediato aunque su token siga vivo. Eso es lo que
cierra el compromiso que la auditoría dejó abierto sobre la revocación.
"""
import pytest
from django.core import mail
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.tenancy.models import Domain, Membership, Tenant

pytestmark = pytest.mark.django_db

CLAVE = "clave-de-prueba-123"


@pytest.fixture
def dos_negocios(db):
    cosecha = Tenant.objects.create(
        slug="la-gran-cosecha", nombre="La Gran Cosecha", estado="ACTIVO"
    )
    perfumeria = Tenant.objects.create(
        slug="perfumeria-xyz", nombre="Perfumería XYZ", estado="ACTIVO"
    )
    Domain.objects.create(tenant=cosecha, hostname="testserver", es_primario=True)
    Domain.objects.create(
        tenant=perfumeria, hostname="perfumeria.plataforma.test", es_primario=True
    )
    return cosecha, perfumeria


@pytest.fixture
def contadora(dos_negocios):
    """Una persona que lleva la contabilidad de los dos negocios."""
    from django.contrib.auth import get_user_model

    cosecha, perfumeria = dos_negocios
    usuario = get_user_model().objects.create_user(
        email_usuario="contadora@ejemplo.test",
        nombre_usuario="Contadora externa",
        password=CLAVE,
        is_staff=True,
    )
    Membership.objects.create(usuario=usuario, tenant=cosecha, rol="ADMIN")
    Membership.objects.create(usuario=usuario, tenant=perfumeria, rol="STAFF")
    return usuario


def iniciar_sesion(api, email):
    """Recorre los dos pasos del login OTP y devuelve el cuerpo del paso 2."""
    paso1 = api.post(
        "/api/auth/login/", {"email_usuario": email, "password": CLAVE}, format="json"
    )
    assert paso1.status_code == 200, paso1.json()

    # El código va en el correo; en tests se lee del outbox en vez de inventarlo.
    cuerpo = mail.outbox[-1].body
    codigo = next(p for p in cuerpo.split() if p.isdigit() and len(p) == 6)

    return api.post(
        "/api/auth/verify-otp/",
        {"otp_ticket": paso1.json()["otp_ticket"], "otp_token": codigo},
        format="json",
    )


# ==========================================================================
# EL NEGOCIO VIAJA EN EL TOKEN
# ==========================================================================
def test_el_token_lleva_el_negocio_activo(api, contadora):
    respuesta = iniciar_sesion(api, contadora.email_usuario)
    assert respuesta.status_code == 200

    claim = AccessToken(respuesta.json()["access"])["tenant_id"]
    assert claim  # va firmado: el cliente no lo puede cambiar


def test_el_negocio_sobrevive_a_la_renovacion_del_token(api, contadora):
    """
    El claim va en el refresh, no solo en el access. Si fuera al revés, el panel
    se quedaría sin negocio en la primera renovación, a la media hora.
    """
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    original = AccessToken(sesion["access"])["tenant_id"]

    renovado = api.post(
        "/api/auth/refresh/", {"refresh": sesion["refresh"]}, format="json"
    )
    assert renovado.status_code == 200
    assert AccessToken(renovado.json()["access"])["tenant_id"] == original


def test_quien_no_trabaja_en_ningun_negocio_no_entra(api, dos_negocios):
    """Desde la fase 3 el acceso lo concede la pertenencia, no `is_staff`."""
    from django.contrib.auth import get_user_model

    huerfano = get_user_model().objects.create_user(
        email_usuario="huerfano@ejemplo.test",
        nombre_usuario="Sin negocio",
        password=CLAVE,
        is_staff=True,
    )
    assert iniciar_sesion(api, huerfano.email_usuario).status_code == 403


# ==========================================================================
# EL SELECTOR DE NEGOCIO
# ==========================================================================
def test_el_perfil_lista_los_negocios_de_la_persona(api, contadora):
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    negocios = cliente.get("/api/auth/me/").json()["negocios"]
    assert {n["slug"] for n in negocios} == {"la-gran-cosecha", "perfumeria-xyz"}
    # Exactamente uno está marcado como activo, para que el selector no dude.
    assert sum(1 for n in negocios if n["activo"]) == 1


def test_cambiar_de_negocio_emite_un_token_nuevo(api, contadora, dos_negocios):
    _, perfumeria = dos_negocios
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    respuesta = cliente.post(
        "/api/auth/cambiar-negocio/", {"negocio": "perfumeria-xyz"}, format="json"
    )
    assert respuesta.status_code == 200
    assert AccessToken(respuesta.json()["access"])["tenant_id"] == str(perfumeria.uuid)


def test_no_se_puede_saltar_a_un_negocio_ajeno(api, contadora):
    """404 y no 403: si no trabaja ahí, ese negocio no existe para ella."""
    Tenant.objects.create(slug="ajena", nombre="Empresa ajena", estado="ACTIVO")

    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    respuesta = cliente.post(
        "/api/auth/cambiar-negocio/", {"negocio": "ajena"}, format="json"
    )
    assert respuesta.status_code == 404


def test_el_rol_que_se_muestra_es_el_del_negocio_activo(api, contadora, dos_negocios):
    """La misma persona es ADMIN en un negocio y STAFF en el otro."""
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    assert cliente.get("/api/auth/me/").json()["rol_en_negocio"] == "ADMIN"

    cambio = cliente.post(
        "/api/auth/cambiar-negocio/", {"negocio": "perfumeria-xyz"}, format="json"
    )
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {cambio.json()['access']}")
    assert cliente.get("/api/auth/me/").json()["rol_en_negocio"] == "STAFF"


# ==========================================================================
# REVOCACIÓN — el compromiso que la auditoría dejó abierto
# ==========================================================================
def test_dar_de_baja_a_alguien_surte_efecto_de_inmediato(
    api, contadora, dos_negocios
):
    """
    El token sigue siendo válido hasta media hora, pero ya no sirve.

    Es la respuesta al riesgo «el JWT conserva un negocio ya revocado»: el claim
    solo elige, y la pertenencia se comprueba en cada petición. No hace falta
    acortar el token ni mantener una lista negra.
    """
    cosecha, _ = dos_negocios
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    assert cliente.get("/api/catalog/products/").status_code == 200

    Membership.objects.filter(usuario=contadora, tenant=cosecha).update(activo=False)

    # Mismo token, sin esperar a que caduque.
    assert cliente.get("/api/catalog/products/").status_code == 403


def test_suspender_un_negocio_corta_el_acceso(api, contadora, dos_negocios):
    cosecha, _ = dos_negocios
    sesion = iniciar_sesion(api, contadora.email_usuario).json()
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion['access']}")

    cosecha.estado = "SUSPENDIDO"
    cosecha.save()

    # Sin negocio operativo no hay nada que servir.
    assert cliente.get("/api/catalog/products/").status_code == 404
