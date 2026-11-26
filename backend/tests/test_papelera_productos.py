"""
La papelera de productos: el «Eliminar» definitivo.

Un producto inactivo vive en la papelera. Desde ahí se puede borrar del todo,
salvo que ya forme parte de la historia de otros (pedidos, ventas del POS,
movimientos de inventario): borrarlo dejaría esos registros sin producto.
"""
import pytest

from apps.catalog.models import HistorialPrecio, PresentacionProducto, Producto
from apps.orders.models import DetallePedido, Pedido


def _url(producto):
    return f"/api/catalog/products/{producto.id}/eliminar-definitivo/"


def _a_la_papelera(producto):
    producto.estado_producto = False
    producto.save(update_fields=["estado_producto"])


@pytest.mark.django_db
def test_borra_el_producto_inactivo_con_sus_presentaciones(api_owner, producto, presentacion, usuario_owner):
    HistorialPrecio.objects.create(
        presentacion=presentacion, precio_anterior=9000, precio_nuevo=10000, usuario=usuario_owner
    )
    _a_la_papelera(producto)

    r = api_owner.delete(_url(producto))

    assert r.status_code == 200, r.data
    assert not Producto.all_tenants.filter(pk=producto.pk).exists()
    assert not PresentacionProducto.all_tenants.filter(pk=presentacion.pk).exists()
    assert not HistorialPrecio.all_tenants.filter(presentacion_id=presentacion.pk).exists()


@pytest.mark.django_db
def test_un_producto_activo_no_se_borra_de_un_clic(api_owner, producto):
    r = api_owner.delete(_url(producto))
    assert r.status_code == 400
    assert Producto.objects.filter(pk=producto.pk).exists()


@pytest.mark.django_db
def test_si_figura_en_un_pedido_se_queda_en_la_papelera(api_owner, producto, presentacion, cliente_negocio):
    pedido = Pedido.objects.create(cliente=cliente_negocio)
    DetallePedido.objects.create(pedido=pedido, presentacion=presentacion, cantidad=2)
    _a_la_papelera(producto)

    r = api_owner.delete(_url(producto))

    assert r.status_code == 409
    assert "1 pedido" in r.data["detail"]
    assert Producto.all_tenants.filter(pk=producto.pk).exists()
    assert DetallePedido.objects.filter(pedido=pedido).exists()


@pytest.mark.django_db
def test_sin_permiso_de_eliminar_no_borra(api_staff, producto):
    _a_la_papelera(producto)
    r = api_staff.delete(_url(producto))
    assert r.status_code == 403
    assert Producto.all_tenants.filter(pk=producto.pk).exists()


def _consecuencias(api, producto):
    return api.get(f"/api/catalog/products/{producto.id}/consecuencias-eliminar/")


@pytest.mark.django_db
def test_las_consecuencias_cuentan_lo_que_se_borra(api_owner, producto, presentacion, usuario_owner):
    HistorialPrecio.objects.create(
        presentacion=presentacion, precio_anterior=9000, precio_nuevo=10000, usuario=usuario_owner
    )
    _a_la_papelera(producto)

    r = _consecuencias(api_owner, producto)

    assert r.status_code == 200, r.data
    assert r.data["puede_eliminar"] is True
    assert r.data["bloqueos"] == []
    assert "1 presentación" in r.data["se_borra"]
    assert "1 cambio de precio del historial" in r.data["se_borra"]


@pytest.mark.django_db
def test_las_consecuencias_avisan_lo_que_impide_borrar(api_owner, producto, presentacion, cliente_negocio):
    pedido = Pedido.objects.create(cliente=cliente_negocio)
    DetallePedido.objects.create(pedido=pedido, presentacion=presentacion, cantidad=1)
    _a_la_papelera(producto)

    r = _consecuencias(api_owner, producto)

    assert r.data["puede_eliminar"] is False
    assert r.data["bloqueos"] == ["1 pedido"]


@pytest.mark.django_db
def test_las_consecuencias_no_son_publicas(api, producto):
    _a_la_papelera(producto)
    assert _consecuencias(api, producto).status_code in (401, 403)


@pytest.mark.django_db(transaction=True)
def test_la_foto_se_borra_del_almacenamiento(api_owner, producto):
    from django.core.files.base import ContentFile
    from PIL import Image
    import io

    salida = io.BytesIO()
    Image.new("RGB", (40, 40), "green").save(salida, "PNG")
    producto.imagen = ContentFile(salida.getvalue(), name="perejil.png")
    producto.save()
    ruta, almacenamiento = producto.imagen.name, producto.imagen.storage
    assert almacenamiento.exists(ruta)
    _a_la_papelera(producto)

    assert _consecuencias(api_owner, producto).data["fotos"] == 1
    assert api_owner.delete(_url(producto)).status_code == 200
    assert not almacenamiento.exists(ruta)


@pytest.mark.django_db
def test_la_papelera_lista_solo_los_inactivos(api_owner, producto, categoria):
    otro = Producto.objects.create(nombre_producto="Activo", categoria=categoria)
    _a_la_papelera(producto)

    r = api_owner.get("/api/catalog/products/", {"estado": "inactivos"})

    ids = [p["id"] for p in (r.data["results"] if isinstance(r.data, dict) else r.data)]
    assert ids == [producto.id]
    assert otro.id not in ids
