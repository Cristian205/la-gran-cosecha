"""
Un token de acceso caducado responde 401, nunca 404.

El panel solo renueva la sesión ante un 401. Con el token caducado el
middleware no puede leer el negocio (`tenant_id` va dentro del token), y las
vistas de negocio respondían 404 «No hay ningún negocio asociado a esta
dirección» antes de autenticar: el panel se quedaba en ese error en vez de
renovar el token y seguir.
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.views import _tokens_para_usuario
from apps.tenancy.models import Membership
from rest_framework_simplejwt.tokens import AccessToken


@pytest.fixture
def persona(tenant_a):
    usuario = get_user_model().objects.create_user(
        email_usuario="gerente@ejemplo.test",
        nombre_usuario="Gerente",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    Membership.objects.create(usuario=usuario, tenant=tenant_a, rol="OWNER")
    return usuario


def _cliente(access):
    cliente = APIClient()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return cliente


@pytest.mark.django_db
def test_con_el_token_vigente_entra_al_negocio(persona, tenant_a):
    access = _tokens_para_usuario(persona, tenant_a)["access"]
    assert _cliente(access).get("/api/catalog/products/").status_code == 200


@pytest.mark.django_db
def test_con_el_token_caducado_responde_401_para_que_el_panel_lo_renueve(persona, tenant_a):
    token = AccessToken(_tokens_para_usuario(persona, tenant_a)["access"])
    token.set_exp(lifetime=-timedelta(minutes=1))
    r = _cliente(str(token)).get("/api/catalog/products/")
    assert r.status_code == 401, r.content


@pytest.mark.django_db
def test_el_refresco_conserva_el_negocio(persona, tenant_a):
    refresh = _tokens_para_usuario(persona, tenant_a)["refresh"]
    r = APIClient().post("/api/auth/refresh/", {"refresh": refresh}, format="json")
    assert r.status_code == 200
    assert _cliente(r.json()["access"]).get("/api/catalog/products/").status_code == 200
