"""
La pantalla de acceso del panel reconoce su negocio por el origen.

El panel llama al backend directamente, así que el `Host` es el de Render y
no dice de qué negocio es: sin esto, el acceso pedía el logo y respondía 404
(«No hay ningún negocio asociado a esta dirección»). Se reconoce por el
`Origin`, pero solo para leer sin sesión.
"""
import pytest
from django.test import RequestFactory

from apps.tenancy.middleware import TenantMiddleware

pytestmark = pytest.mark.django_db

PANEL = "https://panel.ejemplo.app"
# El host del backend en producción: no es dominio de ningún negocio (el
# `testserver` de las pruebas sí lo es, y resolvería antes que el origen).
BACKEND = {"HTTP_HOST": "backend.onrender.com"}


@pytest.fixture
def con_panel(settings, negocio):
    settings.TENANCY_ACEPTA_CABECERA = False
    settings.TENANCY_ORIGENES_PANEL = {"panel.ejemplo.app": negocio.slug}
    return negocio


def _resuelto(metodo="get", **cabeceras):
    request = getattr(RequestFactory(), metodo)("/api/content/site-config/", **BACKEND, **cabeceras)
    return TenantMiddleware(lambda r: None)._resolver(request)


def test_el_acceso_lee_la_marca_de_su_negocio(api, con_panel):
    r = api.get("/api/content/site-config/", HTTP_ORIGIN=PANEL, **BACKEND)
    assert r.status_code == 200, r.content
    assert "logo_url" in r.json()


def test_sin_origen_conocido_sigue_sin_negocio(api, con_panel):
    assert api.get("/api/content/site-config/", **BACKEND).status_code == 404
    assert api.get("/api/content/site-config/", HTTP_ORIGIN="https://otro.app", **BACKEND).status_code == 404


def test_solo_vale_para_leer(con_panel):
    assert _resuelto(HTTP_ORIGIN=PANEL) == con_panel
    assert _resuelto("post", HTTP_ORIGIN=PANEL) is None


def test_con_token_manda_el_jwt_y_no_el_origen(con_panel):
    assert _resuelto(HTTP_ORIGIN=PANEL, HTTP_AUTHORIZATION="Bearer no-vale") is None
