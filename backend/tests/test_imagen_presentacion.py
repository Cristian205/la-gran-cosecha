"""
La foto de cada presentación (`catalog/0010`).

Protege lo que la ficha de la tienda necesita para su galería: que la foto
se suba y se quite, que viaje con el producto en el catálogo público, que se
guarde en el prefijo del negocio, y que solo la cambie quien puede editar
productos.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.catalog.models import PresentacionProducto

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _png(nombre="bulto.png"):
    return SimpleUploadedFile(nombre, PNG, content_type="image/png")


def _url(presentacion):
    return f"/api/catalog/presentations/{presentacion.id}/imagen/"


def test_subir_la_foto_la_publica_en_el_catalogo(api_owner, api, presentacion, negocio):
    r = api_owner.post(_url(presentacion), {"imagen": _png()}, format="multipart")
    assert r.status_code == 200, r.data
    assert r.data["imagen_url"]

    presentacion.refresh_from_db()
    assert presentacion.imagen.name.startswith(f"tenants/{negocio.uuid}/productos/presentaciones/")

    publica = api.get(f"/api/catalog/products/{presentacion.producto_id}/").json()
    [p] = [p for p in publica["presentaciones"] if p["id"] == presentacion.id]
    assert p["imagen_url"].endswith(presentacion.imagen.name.split("/")[-1])


def test_quitar_la_foto(api_owner, presentacion):
    api_owner.post(_url(presentacion), {"imagen": _png()}, format="multipart")
    r = api_owner.delete(_url(presentacion))
    assert r.status_code == 200
    assert r.data["imagen_url"] is None
    presentacion.refresh_from_db()
    assert not presentacion.imagen


def test_sin_foto_la_presentacion_sale_con_imagen_null(api, presentacion):
    publica = api.get(f"/api/catalog/products/{presentacion.producto_id}/").json()
    assert publica["presentaciones"][0]["imagen_url"] is None


@pytest.mark.parametrize(
    "archivo, mensaje",
    [
        (SimpleUploadedFile("doc.pdf", b"%PDF-1.4", content_type="application/pdf"), "Formato"),
        (None, "No se envió"),
    ],
)
def test_rechaza_lo_que_no_es_una_imagen(api_owner, presentacion, archivo, mensaje):
    datos = {"imagen": archivo} if archivo else {}
    r = api_owner.post(_url(presentacion), datos, format="multipart")
    assert r.status_code == 400
    assert mensaje in r.data["mensaje"]


def test_sin_permiso_de_editar_productos_no_se_cambia(api_staff, presentacion):
    r = api_staff.post(_url(presentacion), {"imagen": _png()}, format="multipart")
    assert r.status_code == 403
    assert not PresentacionProducto.objects.get(pk=presentacion.pk).imagen


def test_el_visitante_no_la_cambia(api, presentacion):
    assert api.post(_url(presentacion), {"imagen": _png()}, format="multipart").status_code in (401, 403)
