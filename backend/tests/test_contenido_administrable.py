"""
El contenido de la tienda, administrable de verdad (content/0024,
storefront/0050, filtro `ids` del catálogo).

Protege lo que un administrador necesita para no depender de un
desarrollador: programar banners por fechas, subir/quitar imágenes, fotos en
testimonios, elegir a mano los productos destacados, y que el constructor
sepa qué campos son imágenes o enlaces.
"""
import importlib
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.content.models import Anuncio, PromoBanner, Testimonio

pytestmark = pytest.mark.django_db

def _png(nombre="foto.png"):
    """Una imagen de verdad: la API la valida con Pillow, y un archivo roto no pasa."""
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (8, 8), "green").save(buf, format="PNG")
    return SimpleUploadedFile(nombre, buf.getvalue(), content_type="image/png")


# --------------------------------------------------------------- vigencia
@pytest.mark.parametrize("modelo, ruta", [(PromoBanner, "banners"), (Anuncio, "anuncios")])
def test_el_visitante_solo_ve_lo_vigente(api, api_owner, negocio, modelo, ruta):
    ahora = timezone.now()
    modelo.objects.create(titulo="Siempre")
    modelo.objects.create(titulo="Programado", fecha_inicio=ahora + timedelta(days=2))
    modelo.objects.create(titulo="Vencido", fecha_fin=ahora - timedelta(days=1))
    modelo.objects.create(titulo="En curso", fecha_inicio=ahora - timedelta(days=1), fecha_fin=ahora + timedelta(days=1))
    modelo.objects.create(titulo="Apagado", activo=False)

    def titulos(cliente):
        datos = cliente.get(f"/api/content/{ruta}/").json()
        filas = datos["results"] if isinstance(datos, dict) else datos
        return {f["titulo"] for f in filas}

    assert titulos(api) == {"Siempre", "En curso"}
    # El panel ve todo: lo programado también hay que poder editarlo.
    assert titulos(api_owner) == {"Siempre", "Programado", "Vencido", "En curso", "Apagado"}


# ---------------------------------------------------------------- imágenes
def test_banner_con_imagen_movil_y_quitarla(api_owner, negocio):
    r = api_owner.post(
        "/api/content/banners/",
        {"titulo": "Frutas", "imagen": _png("escritorio.png"), "imagen_movil": _png("movil.png")},
        format="multipart",
    )
    assert r.status_code == 201, r.data
    assert r.data["imagen_url"] and r.data["imagen_movil_url"]

    r = api_owner.patch(f"/api/content/banners/{r.data['id']}/", {"quitar_imagen_movil": "true"}, format="multipart")
    assert r.status_code == 200
    assert r.data["imagen_movil_url"] is None
    assert r.data["imagen_url"]  # la otra se queda


def test_testimonio_con_foto(api_owner, api, negocio):
    r = api_owner.post(
        "/api/content/testimonials/",
        # En multipart un booleano ausente es False (DRF lo lee como casilla
        # sin marcar): el panel manda `activo` siempre, y aquí también.
        {"nombre": "Doña Rosa", "texto": "Todo llega fresco.", "foto": _png("rosa.png"), "activo": "true"},
        format="multipart",
    )
    assert r.status_code == 201, r.data
    publico = api.get("/api/content/testimonials/").json()
    filas = publico["results"] if isinstance(publico, dict) else publico
    assert filas[0]["foto_url"]
    assert Testimonio.objects.get().foto.name.startswith(f"tenants/{negocio.uuid}/contenido/")


# ------------------------------------------------------ destacados a mano
def test_el_catalogo_trae_productos_concretos(api, producto, categoria):
    from apps.catalog.models import Producto

    otro = Producto.objects.create(nombre_producto="Otro", categoria=categoria)
    Producto.objects.create(nombre_producto="Tercero", categoria=categoria)

    datos = api.get(f"/api/catalog/products/?ids={otro.id},{producto.id},abc").json()
    filas = datos["results"] if isinstance(datos, dict) else datos
    assert {p["id"] for p in filas} == {otro.id, producto.id}


def test_los_esquemas_declaran_imagenes_enlaces_y_productos(db):
    from apps.storefront.models import Bloque

    hero = Bloque.objects.get(codigo="hero-campana").esquema_props["properties"]
    assert hero["imagen"]["formato"] == "imagen"
    assert hero["video_url"]["formato"] == "video"
    assert hero["cta_href"]["formato"] == "enlace"
    assert "formato" not in hero["titulo"]

    # Dentro de las listas también: las fotos de cada slide o escena.
    contacto = Bloque.objects.get(codigo="contacto-hero").esquema_props["properties"]
    assert contacto["fotos"]["items"]["properties"]["imagen"]["formato"] == "imagen"

    for codigo in ("producto-spotlight", "favoritos-negocios"):
        productos = Bloque.objects.get(codigo=codigo).esquema_props["properties"]["productos"]
        assert productos["formato"] == "productos"


def test_anotar_no_toca_lo_que_no_reconoce():
    migracion = importlib.import_module("apps.storefront.migrations.0050_campos_con_formato_y_destacados_manuales")
    esquema = {"properties": {"titulo": {"tipo": "string"}, "logo": {"tipo": "string"}}}
    anotado = migracion.anotar(esquema)
    assert anotado["properties"]["logo"]["formato"] == "imagen"
    assert "formato" not in anotado["properties"]["titulo"]
    assert "formato" not in esquema["properties"]["logo"]  # no muta el original


# ------------------------------------------------------------ versiones
def test_el_borrador_nuevo_no_choca_con_una_archivada_de_numero_mayor(api_owner, negocio):
    """
    Regresión: la publicada es la v1 pero existe una ARCHIVADA v2 (pasa si un
    borrador viejo se publica después de otra versión). La vista precarga solo
    borrador y publicada; el siguiente número tiene que salir de TODAS.
    """
    from apps.storefront.models import Pagina, VersionPagina

    pagina = Pagina.objects.create(ruta="/prueba", titulo="Prueba")
    VersionPagina.objects.create(pagina=pagina, numero=1, estado="PUBLICADA", composicion=[])
    VersionPagina.objects.create(pagina=pagina, numero=2, estado="ARCHIVADA", composicion=[])

    r = api_owner.get(f"/api/content/paginas/{pagina.id}/borrador/")
    assert r.status_code == 200, r.content[:300]
    assert r.data["numero"] == 3
