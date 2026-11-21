"""
El modal de gestión de pedidos: edición con trazabilidad.

Las reglas que se prueban aquí son las del negocio, no las de la pantalla:
lo que pidió el cliente no se pierde, lo que agrega el negocio queda marcado,
un personalizado no toca el catálogo, el total cuadra y un doble envío no
duplica líneas.
"""
from decimal import Decimal

import pytest

from apps.catalog.models import Producto, PresentacionProducto
from apps.orders.models import DetallePedido, EventoPedido, Pedido

pytestmark = pytest.mark.django_db


@pytest.fixture
def pedido(api, presentacion):
    respuesta = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Doña Marta", "direccion": "Calle 1 # 2-3", "autoriza_datos": True},
            "items": [{"presentacion_id": presentacion.id, "cantidad": "2"}],
            "observaciones": "Tocar el timbre",
        },
        format="json",
    )
    assert respuesta.status_code == 201, respuesta.content
    return Pedido.objects.get(pk=respuesta.json()["pedido_id"])


@pytest.fixture
def otra_presentacion(presentacion, unidad):
    return PresentacionProducto.objects.create(
        producto=presentacion.producto,
        nombre_presentacion="Medio bulto",
        unidad_venta=unidad,
        factor_conversion=1,
        precio_unitario=6000,
    )


def _leer(api_owner, pedido):
    return api_owner.get(f"/api/orders/{pedido.id}/").json()


def _lineas(datos):
    return [
        {
            "detalle_id": d["id"],
            "presentacion_id": d["presentacion_id"],
            "cantidad": d["cantidad"],
            "precio_unitario": d["precio_unitario"],
        }
        for d in datos["detalles"]
    ]


def test_el_pedido_nuevo_guarda_la_foto_de_lo_que_pidio_el_cliente(pedido):
    recibido = EventoPedido.objects.get(pedido=pedido, tipo="RECIBIDO")
    assert recibido.usuario is None
    assert recibido.datos["lineas"][0]["cantidad"] == "2"
    assert recibido.datos["observaciones"] == "Tocar el timbre"

    linea = pedido.detalles.get()
    assert linea.origen == "CLIENTE"
    assert linea.cantidad_original == Decimal("2")
    assert linea.precio_original == Decimal("10000")


def test_editar_conserva_lo_original_y_lo_registra(api_owner, pedido):
    datos = _leer(api_owner, pedido)
    lineas = _lineas(datos)
    lineas[0]["cantidad"] = "5"
    lineas[0]["precio_unitario"] = "9000"

    r = api_owner.patch(
        f"/api/orders/{pedido.id}/",
        {"detalles": lineas, "version": datos["fecha_modificacion"]},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert Decimal(r.json()["total"]) == Decimal("45000")

    linea = pedido.detalles.get()
    assert linea.cantidad == Decimal("5")
    assert linea.cantidad_original == Decimal("2")
    assert linea.precio_original == Decimal("10000")
    assert linea.fue_modificado

    tipos = set(EventoPedido.objects.filter(pedido=pedido).values_list("tipo", flat=True))
    assert {"CANTIDAD", "PRECIO"} <= tipos


def test_lo_que_agrega_el_negocio_queda_marcado_y_conserva_su_precio(
    api_owner, pedido, otra_presentacion, categoria, unidad
):
    datos = _leer(api_owner, pedido)
    lineas = _lineas(datos) + [
        # Del catálogo, con un precio negociado distinto al de lista.
        {"detalle_id": None, "presentacion_id": otra_presentacion.id, "cantidad": "1", "precio_unitario": "5500"},
        # Personalizado.
        {
            "detalle_id": None,
            "nombre_producto": "Canasta de regalo",
            "unidad_id": unidad.id,
            "categoria_id": categoria.id,
            "cantidad": "1",
            "precio_unitario": "30000",
            "nota": "Con moño",
        },
    ]
    productos_antes = Producto.objects.count()

    r = api_owner.patch(
        f"/api/orders/{pedido.id}/",
        {"detalles": lineas, "version": datos["fecha_modificacion"]},
        format="json",
    )
    assert r.status_code == 200, r.content

    agregadas = pedido.detalles.filter(origen="ADMIN")
    assert agregadas.count() == 2
    catalogo = agregadas.get(presentacion=otra_presentacion)
    assert catalogo.precio_unitario == Decimal("5500")
    assert catalogo.cantidad_original is None
    personalizado = agregadas.get(nombre_personalizado="Canasta de regalo")
    assert personalizado.nota == "Con moño"

    # Un personalizado del negocio no crea producto ni entra a la cola de
    # sugerencias de clientes.
    assert Producto.objects.count() == productos_antes
    pendientes = api_owner.get("/api/orders-productos-pendientes/").json()
    assert all(p["nombre_personalizado"] != "Canasta de regalo" for p in pendientes)

    pedido.refresh_from_db()
    assert pedido.total_pedido == Decimal("20000") + Decimal("5500") + Decimal("30000")
    assert EventoPedido.objects.filter(pedido=pedido, tipo="PRODUCTO_AGREGADO").count() == 2


def test_quitar_un_producto_deja_su_foto_en_la_linea_de_tiempo(api_owner, pedido, otra_presentacion):
    datos = _leer(api_owner, pedido)
    r = api_owner.patch(
        f"/api/orders/{pedido.id}/",
        {
            "detalles": [
                {"detalle_id": None, "presentacion_id": otra_presentacion.id, "cantidad": "1", "precio_unitario": "6000"}
            ],
            "version": datos["fecha_modificacion"],
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    eliminado = EventoPedido.objects.get(pedido=pedido, tipo="PRODUCTO_ELIMINADO")
    assert eliminado.datos["linea"]["cantidad"] == "2"
    assert eliminado.datos["linea"]["origen"] == "CLIENTE"

    linea_de_tiempo = api_owner.get(f"/api/orders/{pedido.id}/linea-de-tiempo/").json()
    tipos = [e["tipo"] for e in linea_de_tiempo]
    assert tipos[-1] == "RECIBIDO"
    assert "PRODUCTO_ELIMINADO" in tipos


def test_un_doble_envio_no_duplica_las_lineas(api_owner, pedido, otra_presentacion):
    datos = _leer(api_owner, pedido)
    cuerpo = {
        "detalles": _lineas(datos)
        + [{"detalle_id": None, "presentacion_id": otra_presentacion.id, "cantidad": "1", "precio_unitario": "6000"}],
        "version": datos["fecha_modificacion"],
    }
    primera = api_owner.patch(f"/api/orders/{pedido.id}/", cuerpo, format="json")
    segunda = api_owner.patch(f"/api/orders/{pedido.id}/", cuerpo, format="json")

    assert primera.status_code == 200
    assert segunda.status_code == 409
    assert pedido.detalles.count() == 2


def test_no_se_cambia_a_una_presentacion_de_otro_producto(api_owner, pedido, categoria, unidad):
    ajeno = Producto.objects.create(nombre_producto="Otro", categoria=categoria)
    ajena = PresentacionProducto.objects.create(
        producto=ajeno, nombre_presentacion="Caja", unidad_venta=unidad, factor_conversion=1, precio_unitario=1
    )
    datos = _leer(api_owner, pedido)
    lineas = _lineas(datos)
    lineas[0]["presentacion_id"] = ajena.id

    r = api_owner.patch(f"/api/orders/{pedido.id}/", {"detalles": lineas}, format="json")
    assert r.status_code == 400


def test_cambiar_de_presentacion_actualiza_el_nombre_de_la_factura(api_owner, pedido, otra_presentacion):
    datos = _leer(api_owner, pedido)
    lineas = _lineas(datos)
    lineas[0]["presentacion_id"] = otra_presentacion.id

    r = api_owner.patch(f"/api/orders/{pedido.id}/", {"detalles": lineas}, format="json")
    assert r.status_code == 200, r.content
    linea = pedido.detalles.get()
    assert "Medio bulto" in linea.nombre_congelado
    assert EventoPedido.objects.filter(pedido=pedido, tipo="PRESENTACION").exists()


@pytest.mark.parametrize(
    "cantidad, precio",
    [("0", "100"), ("-1", "100"), ("1", "-5")],
)
def test_cantidades_y_precios_invalidos_se_rechazan(api_owner, pedido, cantidad, precio):
    datos = _leer(api_owner, pedido)
    lineas = _lineas(datos)
    lineas[0]["cantidad"] = cantidad
    lineas[0]["precio_unitario"] = precio
    r = api_owner.patch(f"/api/orders/{pedido.id}/", {"detalles": lineas}, format="json")
    assert r.status_code == 400
    assert pedido.detalles.get().cantidad == Decimal("2")


def test_la_entrega_se_edita_sin_tocar_lo_que_escribio_el_cliente(api_owner, pedido):
    datos = _leer(api_owner, pedido)
    r = api_owner.patch(
        f"/api/orders/{pedido.id}/",
        {
            "version": datos["fecha_modificacion"],
            "telefono_entrega": "310 555 1234",
            "recibe_nombre": "Portería",
            "fecha_programada": "2026-11-20T09:00:00-05:00",
            "indicaciones_entrega": "Dejar en recepción",
            "notas_internas": "Cliente frecuente",
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    pedido.refresh_from_db()
    assert pedido.observaciones == "Tocar el timbre"
    assert pedido.detalles.count() == 1
    assert pedido.recibe_nombre == "Portería"
    assert pedido.notas_internas == "Cliente frecuente"

    leido = r.json()["pedido"]
    assert leido["telefono_de_contacto"] == "310 555 1234"
    entrega = EventoPedido.objects.get(pedido=pedido, tipo="ENTREGA")
    assert {c["campo"] for c in entrega.datos["cambios"]} == {
        "telefono_entrega",
        "recibe_nombre",
        "fecha_programada",
        "indicaciones_entrega",
    }
    assert EventoPedido.objects.filter(pedido=pedido, tipo="NOTAS").count() == 1


def test_guardar_sin_cambios_no_ensucia_la_linea_de_tiempo(api_owner, pedido):
    datos = _leer(api_owner, pedido)
    r = api_owner.patch(
        f"/api/orders/{pedido.id}/",
        {"detalles": _lineas(datos), "version": datos["fecha_modificacion"]},
        format="json",
    )
    assert r.status_code == 200
    assert list(EventoPedido.objects.filter(pedido=pedido).values_list("tipo", flat=True)) == ["RECIBIDO"]
    assert DetallePedido.objects.get(pedido=pedido).fue_modificado is False


def test_entregar_registra_el_cambio_de_estado(api_owner, pedido):
    r = api_owner.post("/api/orders/entregar/", {"ids": [pedido.id]}, format="json")
    assert r.status_code == 200
    evento = EventoPedido.objects.get(pedido=pedido, tipo="ESTADO")
    assert evento.datos == {"anterior": "PENDIENTE", "nuevo": "ENTREGADO"}
    assert evento.usuario is not None


def test_un_pedido_anterior_a_la_auditoria_muestra_cuando_llego_sin_inventar(api_owner, pedido):
    EventoPedido.objects.filter(pedido=pedido).delete()
    linea_de_tiempo = api_owner.get(f"/api/orders/{pedido.id}/linea-de-tiempo/").json()
    assert len(linea_de_tiempo) == 1
    assert linea_de_tiempo[0]["tipo"] == "RECIBIDO"
    assert linea_de_tiempo[0]["datos"] == {"sin_foto": True}


# ==========================================================================
# El estado del pedido en la tabla: deducido, no guardado
# ==========================================================================
#
# `Pedido.estado` declara cinco valores desde el sistema anterior, pero hoy
# solo se escriben dos (PENDIENTE al crearse, ENTREGADO al entregar). Lo que la
# columna muestra se deduce de hechos que YA están registrados, para que no
# haya dos verdades: la factura generada y el producto sugerido sin aprobar.
# Ver `apps/orders/estado_comercial.py`.
def _fila(api, pedido_id):
    r = api.get("/api/orders/", {"page_size": 100})
    assert r.status_code == 200, r.json()
    filas = r.json()["results"] if isinstance(r.json(), dict) else r.json()
    return next(f for f in filas if f["id"] == pedido_id)


def test_un_pedido_nuevo_del_catalogo_se_muestra_como_recibido(api_owner, pedido):
    fila = _fila(api_owner, pedido.id)
    assert fila["comercial"] == {"estado": "RECIBIDO", "etiqueta": "Recibido", "por_revisar": False}


def test_un_pedido_con_producto_sugerido_se_muestra_por_revisar(api_owner, api, presentacion):
    r = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Don Luis", "direccion": "Calle 9", "autoriza_datos": True},
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
            "personalizados": [{"nombre": "Yuca criolla", "cantidad": "3", "unidad_id": presentacion.unidad_venta_id}],
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    fila = _fila(api_owner, r.json()["pedido_id"])
    assert fila["comercial"]["estado"] == "POR_REVISAR"
    assert fila["comercial"]["por_revisar"] is True


def test_generar_la_factura_deja_el_pedido_como_impreso(api_owner, pedido):
    assert _fila(api_owner, pedido.id)["comercial"]["estado"] == "RECIBIDO"
    assert api_owner.get(f"/api/orders/{pedido.id}/pdf/").status_code == 200
    # No se escribió ninguna columna nueva: el estado guardado sigue igual.
    pedido.refresh_from_db()
    assert pedido.estado == "PENDIENTE"
    assert _fila(api_owner, pedido.id)["comercial"]["etiqueta"] == "Impreso"


def test_el_estado_del_pedido_no_repite_la_entrega(api_owner, pedido):
    """
    Entregar es un hecho del DESPACHO: va en la columna de despacho y no se
    repite en la del pedido, que sigue contando lo suyo (recibido, impreso).
    """
    assert api_owner.post("/api/orders/entregar/", {"ids": [pedido.id]}, format="json").status_code == 200
    fila = _fila(api_owner, pedido.id)
    assert fila["estado"] == "ENTREGADO"
    assert fila["comercial"]["estado"] == "RECIBIDO"
