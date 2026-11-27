"""
El índice que alimenta el sitemap.xml de la tienda.

Cada caso es una URL que NO puede llegar a Google: un producto apagado, uno
sin nada a la venta, uno de una categoría apagada, la página de acceso o la
de «no encontrada». Y una promesa sobre las fechas: el `lastmod` es una fecha
real de cambio, no la hora de la petición.
"""
import pytest
from django.utils import timezone

from apps.catalog.models import Categoria, HistorialPrecio, PresentacionProducto, Producto
from apps.storefront.models import Pagina, VersionPagina

pytestmark = pytest.mark.django_db

URL = "/api/storefront/indice-seo/"


def _vender(producto, unidad, activa=True, precio=1000):
    return PresentacionProducto.objects.create(
        producto=producto,
        nombre_presentacion="Común",
        unidad_venta=unidad,
        factor_conversion=1,
        precio_unitario=precio,
        estado_presentacion=activa,
    )


def _publicar(ruta, bloques, tipo=Pagina.Tipo.LIBRE):
    pagina, _ = Pagina.objects.get_or_create(ruta=ruta, defaults={"titulo": ruta, "tipo": tipo})
    VersionPagina.objects.filter(pagina=pagina).delete()
    return VersionPagina.objects.create(
        pagina=pagina,
        estado=VersionPagina.Estado.PUBLICADA,
        composicion=[{"id": f"b{i}", "tipo": t, "props": {}} for i, t in enumerate(bloques)],
        fecha_publicacion=timezone.now(),
    )


def test_solo_entran_los_productos_publicables(api, categoria, unidad):
    vendible = Producto.objects.create(nombre_producto="Mango", categoria=categoria)
    _vender(vendible, unidad)

    apagado = Producto.objects.create(nombre_producto="Apagado", categoria=categoria, estado_producto=False)
    _vender(apagado, unidad)

    sin_venta = Producto.objects.create(nombre_producto="Sin venta", categoria=categoria)
    _vender(sin_venta, unidad, activa=False)

    oculta = Categoria.objects.create(nombre_categoria="Oculta", abreviatura="OCU", estado_categoria=False)
    de_oculta = Producto.objects.create(nombre_producto="De oculta", categoria=oculta)
    _vender(de_oculta, unidad)

    datos = api.get(URL).json()

    assert [p["slug"] for p in datos["productos"]] == ["mango"]
    assert [c["slug"] for c in datos["categorias"]] == [categoria.slug]
    assert datos["categorias"][0]["num_productos"] == 1


def test_categoria_sin_productos_publicables_no_entra(api, categoria):
    assert api.get(URL).json()["categorias"] == []


def test_lastmod_es_el_ultimo_cambio_real(api, categoria, unidad, usuario_owner):
    producto = Producto.objects.create(nombre_producto="Lulo", categoria=categoria)
    presentacion = _vender(producto, unidad)
    editado = Producto.objects.get(pk=producto.pk).fecha_actualizacion

    primero = api.get(URL).json()["productos"][0]["lastmod"]
    assert primero == editado.isoformat()

    # Un cambio de precio es un cambio de la ficha aunque el producto no se toque.
    cambio = HistorialPrecio.objects.create(
        presentacion=presentacion, precio_anterior=1000, precio_nuevo=1200, usuario=usuario_owner
    )
    HistorialPrecio.objects.filter(pk=cambio.pk).update(
        fecha_cambio=editado + timezone.timedelta(days=3)
    )

    segundo = api.get(URL).json()["productos"][0]["lastmod"]
    assert segundo == (editado + timezone.timedelta(days=3)).isoformat()


def test_paginas_de_servicio_no_son_indexables(api, negocio):
    _publicar("/mayoristas", ["texto-libre"])
    _publicar("/entrar", ["acceso"])
    _publicar("/_no-encontrada", ["texto-libre"])

    paginas = {p["ruta"]: p for p in api.get(URL).json()["paginas"]}

    assert paginas["/mayoristas"]["indexable"] is True
    assert paginas["/mayoristas"]["lastmod"]
    assert paginas["/entrar"]["indexable"] is False
    assert paginas["/_no-encontrada"]["indexable"] is False
    assert "/_layout" not in paginas


def test_la_categoria_expone_su_slug(api, categoria):
    datos = api.get("/api/catalog/categories/").json()
    resultados = datos.get("results", datos)
    assert resultados[0]["slug"] == categoria.slug
