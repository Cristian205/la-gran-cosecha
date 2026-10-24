"""
La hoja de vida de un cliente: un resumen de su historia con el negocio,
calculado SOLO con sus pedidos y su ficha.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.orders.models import Cliente, DetallePedido, Pedido

pytestmark = pytest.mark.django_db


def _pedido(cliente, presentacion, hace_dias, total, estado="ENTREGADO"):
    pedido = Pedido.objects.create(cliente=cliente, estado=estado)
    DetallePedido.objects.create(
        pedido=pedido, presentacion=presentacion, cantidad=1, precio_unitario=presentacion.precio_unitario
    )
    # Fecha y total fijados a mano: `auto_now_add` y el recálculo no dejan elegirlos al crear.
    Pedido.all_tenants.filter(pk=pedido.pk).update(
        fecha_pedido=timezone.now() - timedelta(days=hace_dias), total_pedido=Decimal(total)
    )
    return pedido


def _url(cliente):
    return f"/api/clients/{cliente.id}/hoja-de-vida/"


def test_un_cliente_sin_pedidos(api_owner, cliente_negocio):
    datos = api_owner.get(_url(cliente_negocio)).json()
    assert datos["total_pedidos"] == 0
    assert datos["frecuencia_dias"] is None
    assert datos["relacion"]["codigo"] == "SIN_PEDIDOS"
    assert [h["tipo"] for h in datos["hitos"]] == ["REGISTRO"]


def test_resume_su_historia_con_datos_reales(api_owner, cliente_negocio, presentacion):
    _pedido(cliente_negocio, presentacion, 30, "50000")
    mayor = _pedido(cliente_negocio, presentacion, 20, "90000")
    _pedido(cliente_negocio, presentacion, 10, "40000")

    datos = api_owner.get(_url(cliente_negocio)).json()
    assert datos["total_pedidos"] == 3
    assert Decimal(datos["valor_total"]) == Decimal("180000")
    assert Decimal(datos["ticket_promedio"]) == Decimal("60000")
    assert datos["frecuencia_dias"] == 10.0
    assert datos["dias_desde_ultimo"] == 10
    assert datos["pedido_mayor"]["id"] == mayor.pk
    assert datos["productos_favoritos"][0]["veces"] == 3
    assert datos["relacion"]["codigo"] == "FRECUENTE"
    assert len(datos["pedidos_recientes"]) == 3
    assert datos["pedidos_recientes"][0]["productos"] == 1


def test_avisa_cuando_deja_de_pedir(api_owner, cliente_negocio, presentacion):
    _pedido(cliente_negocio, presentacion, 100, "30000")
    _pedido(cliente_negocio, presentacion, 90, "30000")
    assert api_owner.get(_url(cliente_negocio)).json()["relacion"]["codigo"] == "INACTIVO"


def test_no_se_ve_la_de_otro_negocio(api_owner, tenant_b):
    ajeno = Cliente.all_tenants.create(tenant=tenant_b, nombre_cliente="De otro negocio")
    assert api_owner.get(_url(ajeno)).status_code == 404
