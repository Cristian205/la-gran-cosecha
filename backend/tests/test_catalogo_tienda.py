"""
Lo que la vista /tienda le pide al catálogo para filtrar y ordenar.

Cada caso protege una promesa concreta de la interfaz: "Se vende por" no
repite productos, "Más pedidos" ordena por lo mismo que la sección de
favoritos, la cuenta de cada categoría coincide con lo que se ve, y la
etiqueta "Más pedido" solo sale en productos que de verdad se vendieron.
"""
import pytest

from apps.catalog.models import PresentacionProducto, Producto, UnidadMedida
from apps.orders.models import DetallePedido, Pedido

pytestmark = pytest.mark.django_db


@pytest.fixture
def libra(negocio):
    return UnidadMedida.objects.create(nombre_unidad="Libra", abreviatura_unidad="lb")


@pytest.fixture
def galon(negocio):
    # Existe en el negocio pero ningún producto se vende por galón.
    return UnidadMedida.objects.create(nombre_unidad="Galón", abreviatura_unidad="gal")


def _presentar(producto, unidad, nombre="Común", precio=1000, activa=True):
    return PresentacionProducto.objects.create(
        producto=producto,
        nombre_presentacion=nombre,
        unidad_venta=unidad,
        factor_conversion=1,
        precio_unitario=precio,
        estado_presentacion=activa,
    )


def _entregar(cliente, presentacion, cantidad):
    pedido = Pedido.objects.create(cliente=cliente, estado="ENTREGADO")
    DetallePedido.objects.create(
        pedido=pedido,
        presentacion=presentacion,
        cantidad=cantidad,
        precio_unitario=presentacion.precio_unitario,
    )


def test_filtrar_por_unidad_no_repite_productos(api, producto, unidad, libra):
    # Dos presentaciones en la misma unidad: una unión ingenua lo contaría dos veces.
    _presentar(producto, libra, "Común")
    _presentar(producto, libra, "Casino")
    otro = Producto.objects.create(nombre_producto="Otro", categoria=producto.categoria)
    _presentar(otro, unidad)

    datos = api.get(f"/api/catalog/products/?unidad={libra.id}").json()

    assert datos["count"] == 1
    assert [p["id"] for p in datos["results"]] == [producto.id]


def test_filtrar_por_unidad_ignora_presentaciones_inactivas(api, producto, libra):
    _presentar(producto, libra, activa=False)

    assert api.get(f"/api/catalog/products/?unidad={libra.id}").json()["count"] == 0


def test_mas_pedidos_ordena_por_unidades_entregadas(api, categoria, unidad, cliente_negocio):
    poco = Producto.objects.create(nombre_producto="A poco", categoria=categoria, orden=1)
    mucho = Producto.objects.create(nombre_producto="B mucho", categoria=categoria, orden=2)
    nada = Producto.objects.create(nombre_producto="C nada", categoria=categoria, orden=0)
    _entregar(cliente_negocio, _presentar(poco, unidad), 2)
    _entregar(cliente_negocio, _presentar(mucho, unidad), 9)
    _presentar(nada, unidad)
    # Un pedido sin entregar no cuenta: es el mismo criterio que la sección.
    pendiente = Pedido.objects.create(cliente=cliente_negocio, estado="PENDIENTE")
    DetallePedido.objects.create(
        pedido=pendiente,
        presentacion=nada.presentaciones.first(),
        cantidad=50,
        precio_unitario=1000,
    )

    datos = api.get(
        "/api/catalog/products/?ordering=-unidades_vendidas,orden,nombre_producto"
    ).json()

    assert [p["id"] for p in datos["results"]] == [mucho.id, poco.id, nada.id]
    # El volumen vendido ordena, pero no se publica.
    assert "unidades_vendidas" not in datos["results"][0]


def test_la_categoria_cuenta_solo_productos_activos(api, categoria):
    Producto.objects.create(nombre_producto="Activo", categoria=categoria)
    Producto.objects.create(
        nombre_producto="Inactivo", categoria=categoria, estado_producto=False
    )

    datos = api.get("/api/catalog/categories/").json()
    lista = datos["results"] if isinstance(datos, dict) else datos

    assert lista[0]["num_productos"] == 1


def test_unidades_en_catalogo_solo_trae_las_que_se_usan(api, producto, unidad, libra, galon):
    _presentar(producto, libra, "Común")
    _presentar(producto, libra, "Casino")
    otro = Producto.objects.create(nombre_producto="Otro", categoria=producto.categoria)
    _presentar(otro, libra)
    _presentar(otro, unidad)

    unidades = api.get("/api/catalog/units/?en_catalogo=1").json()

    assert [(u["nombre_unidad"], u["num_productos"]) for u in unidades] == [
        ("Libra", 2),
        ("Kilogramo", 1),
    ]
    # Sin el parámetro, el panel sigue recibiendo el catálogo entero.
    assert len(api.get("/api/catalog/units/").json()) == 3


def test_mas_vendidos_distingue_ranking_de_relleno(api, categoria, unidad, cliente_negocio):
    vendido = Producto.objects.create(nombre_producto="Vendido", categoria=categoria)
    relleno = Producto.objects.create(nombre_producto="Relleno", categoria=categoria)
    _entregar(cliente_negocio, _presentar(vendido, unidad), 3)
    _presentar(relleno, unidad)

    datos = {p["id"]: p["por_ventas"] for p in api.get("/api/orders/productos-mas-vendidos/").json()}

    assert datos == {vendido.id: True, relleno.id: False}


# --------------------------------------------------------------------------
# La composición de /tienda (migración 0046)
# --------------------------------------------------------------------------
def _migracion_0046():
    import importlib

    return importlib.import_module("apps.storefront.migrations.0046_tienda_catalogo_de_compra")


COMPOSICION_ANTERIOR = [
    {"id": "catalogo-hero-0", "tipo": "catalogo-hero", "variante": "compacto",
     "props": {"titulo": "Frescura que mueve", "cta_texto": "Explorar productos"},
     "visible": {"movil": True, "tablet": True, "escritorio": True}},
    {"id": "producto-destacado-0", "tipo": "producto-destacado", "props": {}},
    {"id": "separador-marca-1", "tipo": "separador", "variante": "marca", "props": {}},
    {"id": "separador-marca-3", "tipo": "separador", "variante": "marca", "props": {}},
    {"id": "categorias-navegacion-1", "tipo": "categorias-navegacion", "variante": "pills",
     "props": {"todos_texto": "Todos"}, "visible": {"movil": True, "tablet": False, "escritorio": True}},
    {"id": "catalogo-toolbar-2", "tipo": "catalogo-toolbar", "variante": "completa", "props": {}},
    {"id": "grid-productos-3", "tipo": "grid-productos", "variante": "rejilla",
     "props": {"id": "catalogo", "titulo": "Todos los productos"}},
    {"id": "separador-marca-11", "tipo": "separador", "variante": "marca", "props": {}},
]


def test_la_tienda_queda_en_el_orden_del_catalogo_de_compra():
    nueva, cambiada = _migracion_0046()._componer(COMPOSICION_ANTERIOR)

    assert cambiada
    assert [b["tipo"] for b in nueva] == [
        "catalogo-hero",
        "repetir-pedido",
        "categorias-navegacion",
        "favoritos-negocios",
        "catalogo-toolbar",
        "grid-productos",
    ]


def test_los_bloques_del_catalogo_conservan_id_y_visibilidad():
    nueva, _ = _migracion_0046()._componer(COMPOSICION_ANTERIOR)
    por_tipo = {b["tipo"]: b for b in nueva}

    assert por_tipo["catalogo-hero"]["id"] == "catalogo-hero-0"
    assert por_tipo["grid-productos"]["id"] == "grid-productos-3"
    # Lo que el negocio decidió (ocultar en tablet) no lo pisa la migración.
    assert por_tipo["categorias-navegacion"]["visible"]["tablet"] is False
    # El ancla del catálogo sigue existiendo: el menú y el buscador apuntan a ella.
    assert por_tipo["grid-productos"]["props"]["id"] == "catalogo"
    assert por_tipo["catalogo-hero"]["props"]["cta_texto"] == ""


def test_la_migracion_no_duplica_si_se_vuelve_a_ejecutar():
    migracion = _migracion_0046()
    nueva, _ = migracion._componer(COMPOSICION_ANTERIOR)
    otra_vez, cambiada = migracion._componer(nueva)

    assert not cambiada
    assert otra_vez == nueva


def test_la_composicion_nueva_es_valida_para_el_motor(db):
    from apps.storefront import composicion

    nueva, _ = _migracion_0046()._componer(COMPOSICION_ANTERIOR)

    # Si algún tipo no existiera en el catálogo de bloques, o se repitiera uno
    # único por página, `validar` lanzaría.
    assert len(composicion.validar(nueva)) == len(nueva)
