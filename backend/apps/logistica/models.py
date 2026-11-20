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
from decimal import Decimal

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
    #: Cómo se carga este vehículo (ver `serializers.calcular_esquema`). Vacío
    #: = rejilla uniforme. Ejemplo de La Gran Cosecha:
    #: {"tipo": "frente_columnas", "frente": 4, "izquierda": 7, "derecha": 6, "niveles": 5}
    esquema_carga = models.JSONField(default=dict, blank=True)
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
    #: Pilas (índices de `medidas.pilas`) que el acomodo automático no toca.
    bloqueos = models.JSONField(default=list, blank=True)
    notas = models.TextField(blank=True)

    #: De qué ruta salió: "r<id>" (ruta semanal), "a<id>" (ajuste o ruta extra
    #: de esa fecha), "f<id>" (vehículo agregado a mano en la planificación).
    #: Vacío = despacho armado a mano en el editor.
    ruta_clave = models.CharField(max_length=20, blank=True, default="")
    ruta = models.ForeignKey(
        "Ruta", on_delete=models.SET_NULL, null=True, blank=True, related_name="despachos"
    )
    #: Copia de los datos operativos con los que se armó (ruta, paradas,
    #: clientes, productos consolidados y pedidos). Se toma al generar y se
    #: congela al confirmar: el PDF de un despacho confirmado sale de aquí, así
    #: que cambiar la ruta habitual o un cliente no reescribe el histórico.
    datos_operativos = models.JSONField(default=dict, blank=True)

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
    #: 0 = va consolidado en las canastillas de otro pedido del mismo destino.
    canastillas = models.PositiveIntegerField(validators=[MaxValueValidator(500)])

    class Meta:
        db_table = "logistica_pedido_despacho"
        verbose_name = "Pedido en despacho"
        verbose_name_plural = "Pedidos en despacho"


# ==========================================================================
# Programación semanal de rutas
# ==========================================================================
#
# Qué vehículo visita a qué clientes, en qué orden, cada día de la semana.
#
# * `ProgramacionSemanal` es una PLANTILLA: el negocio puede tener varias
#   («temporada normal», «diciembre») y una sola está activa.
# * `Ruta` es un vehículo en un día de esa plantilla; `ParadaRuta`, cada
#   cliente que visita, con su orden.
# * `AjusteRuta` cambia una ruta SOLO para una fecha (otro vehículo, otras
#   paradas, o no sale), o agrega una ruta extra ese día. La plantilla no se
#   toca: la semana siguiente vuelve la ruta habitual.
#
# Los clientes son los de `orders.Cliente`: la ruta no copia clientes, los
# referencia. Lo que sí se copia es el resultado: el despacho generado guarda
# en `PlanoCarga.datos_operativos` la ruta, las paradas y los productos con
# los que se armó.

DIAS_SEMANA = [
    (0, "Lunes"), (1, "Martes"), (2, "Miércoles"), (3, "Jueves"),
    (4, "Viernes"), (5, "Sábado"), (6, "Domingo"),
]


class ProgramacionSemanal(ModeloConTenant):
    nombre = models.CharField(max_length=80)
    #: La que usa la planificación diaria. Solo una por negocio.
    activa = models.BooleanField(default=False)
    notas = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "logistica_programacion_semanal"
        verbose_name = "Programación semanal"
        verbose_name_plural = "Programaciones semanales"
        ordering = ["-activa", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant"], condition=models.Q(activa=True),
                name="logistica_una_programacion_activa",
            )
        ]

    def __str__(self):
        return self.nombre


class Ruta(ModeloConTenant):
    """Un vehículo en un día de la semana, con su secuencia de clientes."""

    tenant_heredado_de = "programacion"

    programacion = models.ForeignKey(ProgramacionSemanal, on_delete=models.CASCADE, related_name="rutas")
    dia_semana = models.PositiveSmallIntegerField(choices=DIAS_SEMANA)
    nombre = models.CharField(max_length=80)
    furgon = models.ForeignKey(Furgon, on_delete=models.PROTECT, related_name="rutas")
    #: Color con que se identifica la ruta en el centro de planificación.
    color = models.CharField(max_length=7, default="#16a34a")
    notas = models.TextField(blank=True)

    class Meta:
        db_table = "logistica_ruta"
        verbose_name = "Ruta"
        verbose_name_plural = "Rutas"
        ordering = ["dia_semana", "nombre"]
        constraints = [
            # Un vehículo sale una vez por día en la misma plantilla: dos rutas
            # con el mismo furgón el mismo día serían dos cargas en un camión.
            models.UniqueConstraint(
                fields=["programacion", "dia_semana", "furgon"], name="logistica_ruta_un_vehiculo_por_dia"
            )
        ]

    def __str__(self):
        return f"{self.nombre} ({self.get_dia_semana_display()})"


class ParadaRuta(ModeloConTenant):
    tenant_heredado_de = "ruta"

    ruta = models.ForeignKey(Ruta, on_delete=models.CASCADE, related_name="paradas")
    cliente = models.ForeignKey("orders.Cliente", on_delete=models.CASCADE, related_name="paradas_ruta")
    #: 1 = primera visita del día.
    orden = models.PositiveSmallIntegerField()
    nota = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "logistica_parada_ruta"
        verbose_name = "Parada de ruta"
        verbose_name_plural = "Paradas de ruta"
        ordering = ["ruta", "orden"]
        constraints = [
            models.UniqueConstraint(fields=["ruta", "cliente"], name="logistica_parada_cliente_unico"),
        ]

    def __str__(self):
        return f"{self.orden}. {self.cliente_id}"


class AjusteRuta(ModeloConTenant):
    """
    La ruta de UNA fecha, distinta de la habitual. Con `ruta` reemplaza (o
    cancela) esa ruta ese día; sin `ruta`, es una ruta extra solo ese día.
    `paradas` = [{"cliente": id, "nota": ""}] en orden de visita.
    """

    fecha = models.DateField()
    ruta = models.ForeignKey(Ruta, on_delete=models.CASCADE, null=True, blank=True, related_name="ajustes")
    cancelada = models.BooleanField(default=False)
    nombre = models.CharField(max_length=80, blank=True)
    furgon = models.ForeignKey(Furgon, on_delete=models.PROTECT, null=True, blank=True, related_name="ajustes_ruta")
    color = models.CharField(max_length=7, default="#16a34a")
    paradas = models.JSONField(default=list, blank=True)
    motivo = models.CharField(max_length=200, blank=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "logistica_ajuste_ruta"
        verbose_name = "Ajuste de ruta por fecha"
        verbose_name_plural = "Ajustes de ruta por fecha"
        ordering = ["fecha", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "fecha", "ruta"], condition=models.Q(ruta__isnull=False),
                name="logistica_un_ajuste_por_ruta_y_fecha",
            )
        ]

    def __str__(self):
        return f"Ajuste {self.fecha} · {self.nombre or self.ruta_id}"


class ReglaCarga(ModeloConTenant):
    """
    Cómo se carga una presentación: la regla de negocio EXPLÍCITA que permite
    estimar canastillas y peso. Sin regla no se convierte nada: el pedido
    conserva su unidad de venta y el centro de planificación avisa.
    """

    tenant_heredado_de = "presentacion"

    presentacion = models.OneToOneField(
        "catalog.PresentacionProducto", on_delete=models.CASCADE, related_name="regla_carga"
    )
    #: Cuántas unidades de ESTA presentación llenan una canastilla (p. ej. 25
    #: «kilos» de papa, o 1 «bulto»). Vacío = no se sabe.
    unidades_por_canastilla = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(100000)],
    )
    #: Peso en kg de UNA unidad de esta presentación. Vacío = no se sabe.
    peso_kg_por_unidad = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(5000)],
    )
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "logistica_regla_carga"
        verbose_name = "Regla de carga"
        verbose_name_plural = "Reglas de carga"

    def __str__(self):
        return f"Regla de {self.presentacion_id}"
