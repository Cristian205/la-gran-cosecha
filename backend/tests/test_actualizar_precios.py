"""
Edición rápida de precios (`/api/catalog/presentations/actualizar-precios/`).

Protege que cambiar precios sea seguro aunque sea rápido:

- todo o nada: si un cambio falla, no se guarda ninguno;
- cada precio cambiado deja su historial (anterior, nuevo, usuario, fecha),
  y uno que no cambió no deja ruido;
- solo cambia el precio: ni unidad, ni factor, ni otras presentaciones, ni
  los pedidos ya hechos;
- una presentación inactiva o de otro producto no se toca;
- si otra persona la cambió mientras tanto (versión vieja), 409;
- quien no puede editar productos, no puede cambiar precios.
"""
from decimal import Decimal

import pytest

from apps.catalog.models import HistorialPrecio, PresentacionProducto, Producto
from apps.orders.models import DetallePedido, Pedido

pytestmark = pytest.mark.django_db

URL = "/api/catalog/presentations/actualizar-precios/"


@pytest.fixture
def presentaciones(producto, unidad):
    def crear(nombre, precio, activa=True, factor=1):
        return PresentacionProducto.objects.create(
            producto=producto, nombre_presentacion=nombre, unidad_venta=unidad,
            factor_conversion=factor, precio_unitario=precio, estado_presentacion=activa,
        )

    return {
        "kilo": crear("Kilo", Decimal("3000")),
        "bulto": crear("Bulto", Decimal("120000"), factor=50),
        "inactiva": crear("Caja vieja", Decimal("60000"), activa=False),
    }


def _post(api, producto, *cambios):
    return api.post(URL, {"producto": producto.id, "cambios": list(cambios)}, format="json")


def test_cambia_varios_precios_y_deja_historial(api_owner, producto, presentaciones, usuario_owner):
    kilo, bulto = presentaciones["kilo"], presentaciones["bulto"]
    r = _post(
        api_owner, producto,
        {"id": kilo.id, "precio": "3500", "version": kilo.version},
        {"id": bulto.id, "precio": "120000", "version": bulto.version},  # sin cambio
    )
    assert r.status_code == 200, r.json()
    assert r.json()["cambiadas"] == 1

    kilo.refresh_from_db()
    bulto.refresh_from_db()
    assert kilo.precio_unitario == Decimal("3500")
    assert bulto.precio_unitario == Decimal("120000")
    # Solo el precio: la unidad y el factor siguen igual.
    assert bulto.factor_conversion == 50

    historial = list(HistorialPrecio.objects.all())
    assert len(historial) == 1  # el que no cambió no deja ruido
    h = historial[0]
    assert (h.presentacion_id, h.precio_anterior, h.precio_nuevo, h.usuario_id) == (
        kilo.id, Decimal("3000"), Decimal("3500"), usuario_owner.id,
    )


def test_todo_o_nada(api_owner, producto, presentaciones):
    kilo, inactiva = presentaciones["kilo"], presentaciones["inactiva"]
    r = _post(api_owner, producto, {"id": kilo.id, "precio": "9999"}, {"id": inactiva.id, "precio": "1"})
    assert r.status_code == 400
    kilo.refresh_from_db()
    assert kilo.precio_unitario == Decimal("3000")  # tampoco se guardó el válido
    assert not HistorialPrecio.objects.exists()


def test_una_inactiva_no_se_cambia(api_owner, producto, presentaciones):
    r = _post(api_owner, producto, {"id": presentaciones["inactiva"].id, "precio": "70000"})
    assert r.status_code == 400
    assert "inactiva" in str(r.json())


def test_una_de_otro_producto_no_se_cambia(api_owner, producto, presentaciones, categoria, unidad):
    otro = Producto.objects.create(nombre_producto="Otro", categoria=categoria)
    ajena = PresentacionProducto.objects.create(
        producto=otro, nombre_presentacion="Kilo", unidad_venta=unidad, precio_unitario=1000
    )
    r = _post(api_owner, producto, {"id": ajena.id, "precio": "1"})
    assert r.status_code == 400
    ajena.refresh_from_db()
    assert ajena.precio_unitario == Decimal("1000")


def test_version_vieja_da_conflicto(api_owner, producto, presentaciones):
    kilo = presentaciones["kilo"]
    vieja = kilo.version
    kilo.precio_unitario = Decimal("3100")
    kilo.save()  # otra persona guardó
    r = _post(api_owner, producto, {"id": kilo.id, "precio": "3500", "version": vieja})
    assert r.status_code == 409
    kilo.refresh_from_db()
    assert kilo.precio_unitario == Decimal("3100")


@pytest.mark.parametrize("precio", ["0", "-5", "abc", "12.345"])
def test_precio_invalido(api_owner, producto, presentaciones, precio):
    r = _post(api_owner, producto, {"id": presentaciones["kilo"].id, "precio": precio})
    assert r.status_code == 400


def test_no_toca_pedidos_ya_hechos(api_owner, producto, presentaciones, cliente_negocio):
    kilo = presentaciones["kilo"]
    pedido = Pedido.objects.create(cliente=cliente_negocio)
    linea = DetallePedido.objects.create(pedido=pedido, presentacion=kilo, cantidad=2)
    assert _post(api_owner, producto, {"id": kilo.id, "precio": "5000"}).status_code == 200
    linea.refresh_from_db()
    assert linea.precio_unitario == Decimal("3000")


def test_sin_permiso_de_editar_productos(api_staff, producto, presentaciones):
    r = _post(api_staff, producto, {"id": presentaciones["kilo"].id, "precio": "5000"})
    assert r.status_code == 403


def test_historial_de_una_presentacion(api_owner, producto, presentaciones):
    kilo, bulto = presentaciones["kilo"], presentaciones["bulto"]
    _post(api_owner, producto, {"id": kilo.id, "precio": "3500"}, {"id": bulto.id, "precio": "125000"})
    _post(api_owner, producto, {"id": kilo.id, "precio": "3700"})
    r = api_owner.get(f"/api/catalog/presentations/{kilo.id}/historial-precios/")
    assert r.status_code == 200
    filas = r.json()
    assert [f["precio_nuevo"] for f in filas] == ["3700.00", "3500.00"]  # el más reciente primero
    assert all(f["presentacion"] == kilo.id for f in filas)
    assert filas[0]["usuario_nombre"]
