"""
Plano de carga: cómo se acomodan las canastillas dentro de un furgón.

Tres piezas:

* `Furgon` — el espacio de carga útil (largo × ancho × alto, en cm).
* `TipoCanastilla` — la caja que se carga, con sus medidas y cuántas se pueden
  apilar sin aplastar el producto.
* `PlanoCarga` — un despacho concreto: qué grupos de canastillas van (por
  destino o cliente, con su orden de entrega) y en qué hueco quedó cada una.

# Por qué el acomodo es una rejilla y no coordenadas libres

Las canastillas son iguales entre sí, así que el piso del furgón se divide en
huecos del tamaño de una canastilla (filas a lo largo, columnas a lo ancho) y
cada hueco se apila hasta `niveles`. Una posición es entonces (fila, columna,
nivel): se valida en el servidor sin geometría, no hay canastillas que se
atraviesen y ninguna queda flotando.

# Por qué el plano guarda una copia de las medidas

Si mañana se edita el furgón, un plano de la semana pasada tiene que seguir
mostrándose igual: sus posiciones solo tienen sentido con la rejilla con la que
se armaron. `medidas` es esa foto.
"""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.tenancy.models import ModeloConTenant

# Límites de cordura: un furgón de más de 20 m o una canastilla de más de 2 m
# son un error de tecleo (metros escritos como centímetros), no un vehículo.
MEDIDA_FURGON = [MinValueValidator(50), MaxValueValidator(2000)]
MEDIDA_CANASTILLA = [MinValueValidator(5), MaxValueValidator(200)]


class Furgon(ModeloConTenant):
    """
    Un vehículo con su furgón. Las medidas son las INTERIORES del furgón, que
    dependen del carrocero: no hay ficha pública de donde sacarlas, así que se
    registran a mano y `medidas_verificadas` dice si alguien las midió.
    """

    MODELOS_3D = [
        ("hino500", "Hino 500 con furgón"),
        ("foton", "Foton con furgón"),
        ("generico", "Furgón genérico"),
    ]

    nombre = models.CharField(max_length=80)
    placa = models.CharField(max_length=15, blank=True)
    #: Marca, línea y versión tal como figuran en la tarjeta de propiedad.
    referencia = models.CharField(max_length=120, blank=True)
    #: Qué modelo 3D lo representa en el plano (solo visual).
    modelo_3d = models.CharField(max_length=20, choices=MODELOS_3D, default="generico")
    largo_cm = models.PositiveIntegerField(validators=MEDIDA_FURGON)
    ancho_cm = models.PositiveIntegerField(validators=MEDIDA_FURGON)
    alto_cm = models.PositiveIntegerField(validators=MEDIDA_FURGON)
    #: Carga útil en kg según la ficha/tarjeta del vehículo. Vacío = no se sabe,
    #: y entonces el peso no se puede validar (se avisa, no se supone).
    carga_util_kg = models.PositiveIntegerField(null=True, blank=True, validators=[MaxValueValidator(60000)])
    #: Distancia entre ejes y altura del piso del furgón: ubican el modelo 3D.
    distancia_entre_ejes_mm = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1500), MaxValueValidator(9000)]
    )
    altura_piso_mm = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(300), MaxValueValidator(2000)]
    )
    medidas_verificadas = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "logistica_furgon"
        verbose_name = "Furgón"
        verbose_name_plural = "Furgones"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class TipoCanastilla(ModeloConTenant):
    """La caja estándar que se carga. Casi siempre hay una sola."""

    nombre = models.CharField(max_length=80)
    largo_cm = models.PositiveIntegerField(validators=MEDIDA_CANASTILLA)
    ancho_cm = models.PositiveIntegerField(validators=MEDIDA_CANASTILLA)
    alto_cm = models.PositiveIntegerField(validators=MEDIDA_CANASTILLA)
    #: Cuántas se apilan como máximo para no aplastar el producto. 0 = las que
    #: quepan por la altura del furgón.
    max_apiladas = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(50)])
    #: Peso de una canastilla LLENA, en kg. Vacío = no se sabe.
    peso_lleno_kg = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, validators=[MaxValueValidator(500)]
    )
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "logistica_tipo_canastilla"
        verbose_name = "Tipo de canastilla"
        verbose_name_plural = "Tipos de canastilla"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class PlanoCarga(ModeloConTenant):
    """
    Un despacho: qué pedidos van, en qué vehículo, y dónde quedó cada
    canastilla. `fecha` es el día de ENTREGA, no el de creación.
    """

    BORRADOR = "BORRADOR"
    CONFIRMADO = "CONFIRMADO"
    ESTADOS = [(BORRADOR, "Borrador"), (CONFIRMADO, "Confirmado")]

    nombre = models.CharField(max_length=120)
    estado = models.CharField(max_length=12, choices=ESTADOS, default=BORRADOR)
    fecha = models.DateField()
    furgon = models.ForeignKey(Furgon, on_delete=models.PROTECT, related_name="planos")
    tipo_canastilla = models.ForeignKey(TipoCanastilla, on_delete=models.PROTECT, related_name="planos")

    #: Foto de las medidas y de la rejilla con las que se armó (ver docstring).
    #: {"furgon": {largo, ancho, alto}, "canastilla": {largo, ancho, alto},
    #:  "girada": bool, "filas": n, "columnas": n, "niveles": n}
    medidas = models.JSONField(default=dict)
    #: [{"id", "nombre", "cantidad", "orden", "color"}] — `orden` 1 se entrega
    #: primero, así que va junto a la puerta.
    grupos = models.JSONField(default=list)
    #: [{"grupo", "fila", "columna", "nivel"}] — fila 0 es el fondo (contra la
    #: cabina); la última fila, la puerta.
    posiciones = models.JSONField(default=list)
    notas = models.TextField(blank=True)

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    confirmado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    confirmado_en = models.DateTimeField(null=True, blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "logistica_plano_carga"
        verbose_name = "Plano de carga"
        verbose_name_plural = "Planos de carga"
        ordering = ["-fecha", "-creado"]

    def __str__(self):
        return f"{self.nombre} ({self.fecha})"


class PedidoDespacho(ModeloConTenant):
    """
    Un pedido dentro de un despacho, con cuántas canastillas ocupa.

    `pedido` es ÚNICO: un pedido no puede ir en dos despachos a la vez. Es la
    garantía de que al planificar no se duplican pedidos ni canastillas.
    """

    plano = models.ForeignKey(PlanoCarga, on_delete=models.CASCADE, related_name="pedidos")
    pedido = models.OneToOneField("orders.Pedido", on_delete=models.CASCADE, related_name="despacho_asignado")
    #: El destino (grupo) del plano al que pertenece: `grupos[].id`.
    grupo = models.CharField(max_length=40)
    canastillas = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(500)])

    class Meta:
        db_table = "logistica_pedido_despacho"
        verbose_name = "Pedido en despacho"
        verbose_name_plural = "Pedidos en despacho"
