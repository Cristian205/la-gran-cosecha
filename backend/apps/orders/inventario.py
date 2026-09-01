"""
El puente entre los pedidos y el libro mayor de existencias.

La tienda RESERVA y el mostrador DESCUENTA, y la diferencia no es un detalle de
implementación: entre que un cliente confirma un pedido online y el repartidor
sale pueden pasar horas, y durante esas horas la mercancía ni está vendida ni se
puede volver a prometer. Reservar es lo que hace que el conteo físico de la
bodega siga cuadrando con lo que hay en las estanterías mientras tanto.

# Por qué todo pasa por «resincronizar»

Un pedido no se reserva una vez y ya. Se crea, luego alguien le cambia una
cantidad desde el panel, luego se le borra una línea, luego se entrega. Escribir
un movimiento en cada uno de esos puntos es la vía directa a que la reserva
derive de las líneas reales en cuanto se olvide uno.

Así que hay una sola función que hace el trabajo —`resincronizar_reserva`— y
funciona por diferencia: mira lo que este pedido tiene reservado AHORA, calcula
lo que DEBERÍA tener según sus líneas, y mueve la diferencia. Se puede llamar
las veces que haga falta y en cualquier orden; llamarla dos veces seguidas no
hace nada la segunda. Eso es lo que la vuelve segura de poner en un `save()`, en
una señal y en una acción del panel a la vez.

# Qué se queda fuera, y no por descuido

Las líneas personalizadas —las que el cliente escribe a mano y todavía no son
producto de catálogo— no mueven inventario: no hay nada de lo que descontar.
Y los productos con `controla_stock=False` tampoco, que son todos los que ya
existían el día que esta app entró en servicio. Encender el inventario no puede
empezar a rechazar pedidos de un catálogo cuyo stock nadie ha cargado.
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.inventory import operaciones
from apps.inventory.models import MovimientoInventario

CERO = Decimal("0")

#: Cómo se firma un movimiento que nace de un pedido. El kardex lo muestra tal
#: cual, y `_reservado_actual` lo usa para saber qué apartó este pedido y no
#: otro. Es una referencia floja a propósito: ver `MovimientoInventario`.
ORIGEN = "orders.Pedido"


def _lineas_con_stock(pedido):
    """
    Las líneas del pedido que de verdad mueven existencias.

    Devuelve tuplas `(producto, presentacion, cantidad_base)`. La conversión a
    unidad base ocurre aquí, una vez: tres cajas de doce son treinta y seis
    unidades, y el saldo del producto se lleva en unidades.
    """
    detalles = (
        pedido.detalles.select_related("presentacion__producto")
        .filter(presentacion__isnull=False)
    )
    for detalle in detalles:
        producto = detalle.presentacion.producto
        if not producto.controla_stock:
            continue
        yield (
            producto,
            detalle.presentacion,
            operaciones.a_unidad_base(detalle.presentacion, detalle.cantidad),
        )


def _reservado_actual(pedido) -> dict:
    """
    Cuánto tiene apartado este pedido ahora mismo, por producto.

    Se calcula sumando sus propios movimientos de reserva en vez de guardarlo en
    una columna del pedido. Es más lento y es lo correcto: una columna sería un
    segundo sitio donde vive la misma verdad, y el día que las dos discrepen no
    habría forma de saber cuál miente. El histórico no puede discrepar consigo
    mismo.
    """
    filas = (
        MovimientoInventario.all_tenants.filter(
            tenant=pedido.tenant_id,
            origen_tipo=ORIGEN,
            origen_id=pedido.pk,
            tipo__in=MovimientoInventario.TIPOS_DE_RESERVA,
        )
        .values("producto_id")
        .annotate(neto=Sum("cantidad"))
    )
    return {fila["producto_id"]: fila["neto"] or CERO for fila in filas}


@transaction.atomic
def resincronizar_reserva(pedido, *, usuario=None):
    """
    Deja la reserva de este pedido igual a lo que dicen sus líneas.

    Lanza `StockInsuficiente` si falta mercancía para lo que se pide de más. Que
    salga como excepción y no como un valor de retorno es deliberado: quien
    llama está dentro de una transacción, y lo que corresponde es que el pedido
    entero no se guarde, no que se guarde a medias con una reserva incompleta.
    """
    objetivo = defaultdict(lambda: CERO)
    presentaciones = {}
    productos = {}
    for producto, presentacion, cantidad_base in _lineas_con_stock(pedido):
        objetivo[producto.pk] += cantidad_base
        productos[producto.pk] = producto
        presentaciones.setdefault(producto.pk, presentacion)

    actual = _reservado_actual(pedido)
    for producto_id in set(objetivo) | set(actual):
        diferencia = objetivo.get(producto_id, CERO) - actual.get(producto_id, CERO)
        if diferencia == CERO:
            continue

        producto = productos.get(producto_id)
        if producto is None:
            # La línea desapareció del pedido (la borraron, o el producto dejó
            # de controlar stock). Lo apartado vuelve a estar a la venta.
            producto = _producto_de(producto_id, pedido)

        operacion = operaciones.reservar if diferencia > CERO else operaciones.liberar
        operacion(
            producto,
            abs(diferencia),
            presentacion=presentaciones.get(producto_id),
            origen_tipo=ORIGEN,
            origen_id=pedido.pk,
            usuario=usuario,
            motivo=f"Pedido #{pedido.pk}",
        )


@transaction.atomic
def despachar_pedido(pedido, *, usuario=None):
    """
    El pedido sale por la puerta: lo apartado deja de estarlo y se descuenta.

    Es idempotente porque trabaja sobre lo que queda reservado: entregar dos
    veces el mismo pedido no descuenta dos veces, porque la segunda no hay nada
    apartado que convertir. La acción de entregar del panel es masiva y se ha
    pulsado dos veces más de una vez.
    """
    pendiente = _reservado_actual(pedido)
    for producto_id, cantidad in pendiente.items():
        if cantidad <= CERO:
            continue
        operaciones.despachar(
            _producto_de(producto_id, pedido),
            cantidad,
            origen_tipo=ORIGEN,
            origen_id=pedido.pk,
            usuario=usuario,
            motivo=f"Entrega del pedido #{pedido.pk}",
        )


@transaction.atomic
def liberar_pedido(pedido, *, usuario=None):
    """Se cancela o se borra el pedido: todo lo apartado vuelve a la venta."""
    for producto_id, cantidad in _reservado_actual(pedido).items():
        if cantidad <= CERO:
            continue
        operaciones.liberar(
            _producto_de(producto_id, pedido),
            cantidad,
            origen_tipo=ORIGEN,
            origen_id=pedido.pk,
            usuario=usuario,
            motivo=f"Cancelación del pedido #{pedido.pk}",
        )


def _producto_de(producto_id, pedido):
    """
    El producto por id, sin depender del contexto declarado.

    `all_tenants` con filtro explícito porque esto corre también desde señales
    de borrado, donde no hay petición de la que heredar el ámbito — el mismo
    criterio que `orders/signals.py` ya aplica.
    """
    from apps.catalog.models import Producto  # noqa: PLC0415 — evita el ciclo

    return Producto.all_tenants.get(tenant=pedido.tenant_id, pk=producto_id)
