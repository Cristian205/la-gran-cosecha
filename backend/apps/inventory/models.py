"""
El libro mayor de existencias de Crynex.

Hasta aquí la plataforma no sabía cuánto hay de nada: el catálogo tenía precios
y presentaciones, los pedidos sumaban totales, y nadie descontaba. Esta app es
la pieza de la que dependen el POS, la disponibilidad real de la tienda y las
compras, y por eso va antes que ninguna de las tres.

Tres modelos y una sola idea:

    MovimientoInventario   lo que pasó. Append-only. Es la VERDAD.
    Existencia             cuánto hay ahora. Caché derivada de lo anterior.
    Ubicacion              dónde. La tienda, la bodega, la camioneta.

Existencia se podría calcular sumando movimientos, y de hecho así se comprueba
(ver `recalcular()`). No se hace en cada lectura porque la tienda pregunta «¿hay
stock?» en cada tarjeta de producto, y sumar un histórico entero por producto y
por visita es insostenible desde el primer mes. La regla que mantiene honesta la
caché es que solo hay UN escritor: `operaciones.mover()`.

# El grano: por producto y en unidad base

`Existencia` cuelga del PRODUCTO, no de la presentación, y su cantidad va
siempre en la unidad base del producto. Es lo que dicta el propio catálogo:
`Producto.unidad_base` más `PresentacionProducto.factor_conversion` ya dicen que
una presentación es «N unidades base», así que la caja de 12 y la unidad suelta
son el MISMO montón físico. Con existencias por presentación, vender una caja no
descontaría de las unidades sueltas y el negocio vendería dos veces la misma
mercancía.

La consecuencia, y conviene decirla porque es contraintuitiva: dos variantes con
stock propio —la talla M y la talla L de una camisa— son dos PRODUCTOS, no dos
presentaciones del mismo. Es también como lo trata cualquier tienda real: cada
SKU es un artículo. La presentación sigue siendo el eje del precio y de la venta;
no es el eje del inventario.

# Lo que NO está aquí

Costes, valoración, lotes, caducidades y trazabilidad por número de serie. Todos
son reales y ninguno hace falta para vender: se añaden como columnas del
movimiento el día que un negocio los pida, sin cambiar el grano de la tabla.
"""
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# 1. UBICACIÓN — dónde está la mercancía
# ==========================================================================
class Ubicacion(ModeloConTenant):
    """
    Un sitio donde hay existencias.

    Existe desde el primer día aunque casi todos los negocios tengan una sola,
    por la misma razón que `Domain` existía en la fase 1 con un solo subdominio:
    meter la ubicación en la clave de `Existencia` desde el principio hace que
    abrir la segunda tienda sea un alta, y no una migración del inventario
    entero con el negocio en marcha.
    """

    class Tipo(models.TextChoices):
        TIENDA = "TIENDA", "Punto de venta"
        BODEGA = "BODEGA", "Bodega"
        VEHICULO = "VEHICULO", "Vehículo de reparto"

    nombre = models.CharField(max_length=120)
    codigo = models.SlugField(max_length=40)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.TIENDA)

    #: Adónde van los movimientos que no dicen ubicación: la venta en el
    #: mostrador, el pedido de la tienda online. Sin una predeterminada, cada
    #: llamada tendría que elegir y la mitad elegiría mal.
    es_predeterminada = models.BooleanField(default=False)

    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_ubicacion"
        verbose_name = "Ubicación"
        verbose_name_plural = "Ubicaciones"
        ordering = ["-es_predeterminada", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "codigo"],
                name="inventory_codigo_ubicacion_unico_por_negocio",
            ),
            # Dos predeterminadas dejarían a suerte del orden de la consulta
            # de qué bodega descuenta una venta.
            models.UniqueConstraint(
                fields=["tenant"],
                condition=models.Q(es_predeterminada=True),
                name="inventory_una_sola_ubicacion_predeterminada",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "activa"], name="inventory_ubic_activa_idx"),
        ]

    def __str__(self):
        return self.nombre


# ==========================================================================
# 2. EXISTENCIA — cuánto hay ahora
# ==========================================================================
class Existencia(ModeloConTenant):
    """
    El saldo de un producto en una ubicación, en unidad base.

    Nadie escribe estas dos columnas fuera de `operaciones.mover()`. No es una
    recomendación de estilo: es lo único que sostiene que el saldo cuadre con
    los movimientos, y por eso `mover()` es también el único sitio donde se
    toma el bloqueo de fila.

    `cantidad` es lo que hay físicamente. `reservada` es la parte que ya está
    comprometida en un pedido confirmado y todavía no ha salido por la puerta.
    Lo que la tienda puede vender es la diferencia. Separarlas es lo que permite
    que el pedido online aparte mercancía durante las horas que tarda en
    entregarse sin fingir que ya salió — y que el conteo físico de la bodega
    siga cuadrando con `cantidad`.
    """

    tenant_heredado_de = "producto"

    producto = models.ForeignKey(
        "catalog.Producto", on_delete=models.CASCADE, related_name="existencias"
    )
    ubicacion = models.ForeignKey(
        Ubicacion, on_delete=models.PROTECT, related_name="existencias"
    )

    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reservada = models.DecimalField(
        max_digits=14, decimal_places=3, default=0, validators=[MinValueValidator(0)]
    )

    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_existencia"
        verbose_name = "Existencia"
        verbose_name_plural = "Existencias"
        ordering = ["producto__nombre_producto"]
        constraints = [
            # La clave del grano. Sin esto, dos filas para el mismo producto en
            # la misma bodega y un saldo que depende de cuál lea cada consulta.
            models.UniqueConstraint(
                fields=["tenant", "producto", "ubicacion"],
                name="inventory_una_existencia_por_producto_y_ubicacion",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant", "ubicacion"], name="inventory_exis_ubicacion_idx"
            ),
        ]

    def __str__(self):
        return f"{self.producto} · {self.ubicacion}: {self.disponible}"

    @property
    def disponible(self):
        """Lo que se puede vender: lo que hay menos lo ya comprometido."""
        return self.cantidad - self.reservada


# ==========================================================================
# 3. MOVIMIENTO — lo que pasó
# ==========================================================================
class MovimientoInventario(ModeloConTenant):
    """
    Una línea del libro mayor. Se escribe una vez y no se toca nunca más.

    Es la tabla que permite responder «¿por qué hay siete y no nueve?», que en
    un negocio real se pregunta cada semana. Por eso no se corrige un movimiento
    equivocado: se escribe un AJUSTE con su motivo, y los dos quedan a la vista.

    `origen_tipo` y `origen_id` son una referencia deliberadamente floja —texto
    y entero, sin clave foránea—. Un movimiento apunta a una venta del POS, a un
    pedido de la tienda o a nada en absoluto, y meter aquí una `GenericForeignKey`
    obligaría a esta app a conocer todas las que la usan, que es justo la
    dependencia que la modularidad no puede permitirse. Que el pedido de origen
    se borre no invalida el movimiento: la mercancía salió igual.
    """

    class Tipo(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada"
        SALIDA = "SALIDA", "Salida"
        AJUSTE = "AJUSTE", "Ajuste por conteo"
        TRASLADO = "TRASLADO", "Traslado entre ubicaciones"
        RESERVA = "RESERVA", "Reserva"
        LIBERACION = "LIBERACION", "Liberación de reserva"

    #: Los que mueven `reservada` en vez de `cantidad`. Lo consulta `mover()`.
    TIPOS_DE_RESERVA = (Tipo.RESERVA, Tipo.LIBERACION)

    tenant_heredado_de = "producto"

    producto = models.ForeignKey(
        "catalog.Producto", on_delete=models.PROTECT, related_name="movimientos"
    )
    ubicacion = models.ForeignKey(
        Ubicacion, on_delete=models.PROTECT, related_name="movimientos"
    )

    #: Solo para poder leer el histórico en los términos en que se vendió
    #: («3 cajas de 12») además de en unidad base («36 unidades»). No participa
    #: en el saldo y puede quedar vacía en una entrada de bodega o un ajuste.
    presentacion = models.ForeignKey(
        "catalog.PresentacionProducto",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos",
    )

    tipo = models.CharField(max_length=20, choices=Tipo.choices)

    #: CON SIGNO y en unidad base. Una salida es negativa. Guardarlo firmado en
    #: vez de con una columna de sentido aparte hace que comprobar el saldo sea
    #: una suma, y esa suma es la prueba de que la caché no ha derivado.
    cantidad = models.DecimalField(max_digits=14, decimal_places=3)

    #: El saldo que quedó tras aplicar este movimiento. Redundante a propósito:
    #: sin él, reconstruir el estado de un día concreto obliga a sumar el
    #: histórico entero, que es la consulta que más se pide al investigar un
    #: descuadre.
    saldo_resultante = models.DecimalField(
        max_digits=14, decimal_places=3, null=True, blank=True
    )

    origen_tipo = models.CharField(max_length=60, blank=True)
    origen_id = models.PositiveBigIntegerField(null=True, blank=True)

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos_inventario",
    )
    motivo = models.CharField(max_length=255, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_movimiento"
        verbose_name = "Movimiento de inventario"
        verbose_name_plural = "Movimientos de inventario"
        ordering = ["-fecha", "-id"]
        indexes = [
            # El kardex de un producto: la consulta que hace el panel al abrir
            # la ficha, y la que resuelve cualquier descuadre.
            models.Index(
                fields=["tenant", "producto", "-fecha"],
                name="inventory_mov_producto_idx",
            ),
            models.Index(
                fields=["tenant", "origen_tipo", "origen_id"],
                name="inventory_mov_origen_idx",
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} {self.cantidad:+} · {self.producto}"
