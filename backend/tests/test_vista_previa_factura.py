"""
La vista previa de la factura (Configuración → Facturación).

Es la factura real (mismo HTML, mismo WeasyPrint) de un pedido de prueba,
con los datos del formulario aunque aún no se hayan guardado.
"""
import io

import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.content.models import StoreSettings
from apps.orders import pdf

pytestmark = pytest.mark.django_db

URL = "/api/orders/factura/vista-previa/"


@pytest.fixture
def contexto(monkeypatch):
    """Guarda el contexto con el que se pintó la factura, para revisarlo."""
    capturado = {}
    original = pdf.render_to_string

    def espia(plantilla, ctx, *args, **kwargs):
        capturado.update(ctx)
        capturado["_plantilla"] = plantilla
        capturado["_html"] = original(plantilla, ctx, *args, **kwargs)
        return capturado["_html"]

    monkeypatch.setattr(pdf, "render_to_string", espia)
    return capturado


def test_devuelve_la_factura_en_pdf_con_productos_reales(api_owner, presentacion, contexto):
    r = api_owner.post(URL, {}, format="multipart")
    assert r.status_code == 200
    assert r["Content-Type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    # Es la plantilla de la factura de verdad, con el producto y el precio del catálogo.
    assert contexto["_plantilla"] == "orders/pdf/factura.html"
    assert presentacion.producto.nombre_producto in contexto["_html"]
    assert "cliente de prueba" in contexto["_html"].lower()


def test_usa_los_valores_del_formulario_sin_guardarlos(api_owner, negocio, contexto):
    r = api_owner.post(
        URL,
        {
            "factura_nit": "900.123.456-7",
            "factura_eslogan": "Distribuidora mayorista",
            "factura_marca_agua_texto": "COPIA",
            "factura_marca_agua_opacidad": "90",
            "factura_marca_agua_activa": "true",
            "factura_chip_secundario": "Régimen simple",
        },
        format="multipart",
    )
    assert r.status_code == 200
    assert contexto["factura_nit"] == "900.123.456-7"
    assert contexto["factura_eslogan"] == "Distribuidora mayorista"
    assert contexto["marca_agua_texto"] == "COPIA"
    assert contexto["marca_agua_opacidad"] == "0.40"  # se acota a 40 %
    assert contexto["chip_secundario"] == "Régimen simple"
    # Nada se guardó: es una vista previa.
    config = StoreSettings.get_para(negocio)
    assert config is None or config.factura_nit != "900.123.456-7"


def test_apagar_la_marca_de_agua_se_refleja(api_owner, contexto):
    api_owner.post(URL, {"factura_marca_agua_activa": "false"}, format="multipart")
    assert contexto["marca_agua_activa"] is False


def test_un_logo_recien_elegido_entra_en_la_vista_previa(api_owner, contexto):
    salida = io.BytesIO()
    Image.new("RGBA", (40, 40), (200, 30, 30, 255)).save(salida, "PNG")
    logo = SimpleUploadedFile("logo.png", salida.getvalue(), content_type="image/png")
    api_owner.post(URL, {"factura_logo": logo, "factura_aplicar_tinte_logo": "false"}, format="multipart")
    assert contexto["logo_data"]


def test_sin_catalogo_usa_lineas_de_ejemplo(api_owner, contexto):
    r = api_owner.post(URL, {}, format="multipart")
    assert r.status_code == 200
    assert contexto["pedido"].total_pedido > 0


def test_pide_sesion(api):
    # Sin sesión no hay negocio ni permiso: nunca sale un PDF.
    r = api.post(URL, {}, format="multipart")
    assert r.status_code in (401, 403, 404)
    assert not r.content.startswith(b"%PDF")
