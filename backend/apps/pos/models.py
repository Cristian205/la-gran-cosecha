"""
La caja: un solo POS, configurable, para todos los negocios.

No hay un POS de boutique y otro de ferretería. Hay uno genérico cuya
experiencia la decide `PerfilNegocio.perfil_pos`: qué busca el cajero, qué pide
por línea, qué panel lleva al lado y qué pasa al cobrar. Es la misma técnica que
la tienda —una aplicación, muchas configuraciones—, y por la misma razón:
mejorar la caja tiene que mejorarla en los cuarenta negocios a la vez.

Cinco modelos:

    Turno       la apertura y el cierre de la caja. Cuadra el efectivo.
    Venta       lo que se cobró, con su contexto.
    LineaVenta  cada renglón, congelado tal como se vendió.
    MedioPago   efectivo, tarjeta, transferencia…
    Pago        cuánto se pagó con cada medio. Una venta admite varios.

# La caja descuenta; no reserva

Es la diferencia deliberada con la tienda online. En el mostrador no hay ventana
entre confirmar y entregar: la bolsa se la lleva el cliente. Así que cobrar
escribe una SALIDA en el mismo libro mayor que usa la tienda, dentro de la misma
transacción. No hay sincronización porque no hay dos almacenes de datos.

# Lo que NO está aquí, y no por descuido

Facturación electrónica y numeración fiscal. La numeración de este módulo es
operativa —sirve para encontrar una venta y cuadrar un turno—, no fiscal: una
resolución de la DIAN tiene rangos, vigencias y contingencias propios, y
mezclarlo con el consecutivo de caja obliga a rehacer los dos cuando llegue.
Va en el módulo de facturación, que es donde el encargo ya lo puso.

Tampoco hay modo sin conexión. Es lo que más se pide y lo que más cuesta:
identificadores generados en cliente, cola de sincronización y conflictos de
stock. Contamina cada decisión de aquí si se asume desde el principio.
"""
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# 1. MEDIO DE PAGO
# ==========================================================================
class MedioPago(ModeloConTenant):
    """
    Con qué se puede cobrar en este negocio.

    Es una tabla y no una lista de opciones en código porque cada negocio tiene
    los suyos: uno acepta Nequi y Daviplata, otro solo efectivo y datáfono.
    Añadir uno es un alta, no un despliegue.

    `tipo` sí es cerrado, porque de él dependen dos comportamientos reales: si
    el medio cuenta para el arqueo de efectivo al cerrar el turno, y si admite
    una referencia (el número de aprobación de la tarjeta, el del comprobante).
    """

    class Tipo(models.TextChoices):
        EFECTIVO = "EFECTIVO", "Efectivo"
        TARJETA = "TARJETA", "Tarjeta"
        TRANSFERENCIA = "TRANSFERENCIA", "Transferencia"
        CREDITO = "CREDITO", "Fiado"
        OTRO = "OTRO", "Otro"

    #: Los que se cuentan en el arqueo. Solo el efectivo está físicamente en el
    #: cajón; lo demás llega al banco y no se cuadra contando billetes.
    TIPOS_EN_CAJA = (Tipo.EFECTIVO,)

    codigo = models.SlugField(max_length=40)
    nombre = models.CharField(max_length=60)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.EFECTIVO)
    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "pos_mediopago"
        verbose_name = "Medio de pago"
        verbose_name_plural = "Medios de pago"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "codigo"], name="pos_medio_unico_por_negocio"
            )
        ]

    def __str__(self):
        return self.nombre

    @property
    def cuenta_en_caja(self) -> bool:
        return self.tipo in self.TIPOS_EN_CAJA


# ==========================================================================
# 2. TURNO
# ==========================================================================
class Turno(ModeloConTenant):
    """
    Una jornada de caja: quién abrió, con cuánto, y qué había al cerrar.

    Existe por una razón muy concreta: al final del día alguien cuenta el dinero
    del cajón y tiene que cuadrar. `total_declarado` es lo que contó,
    `total_calculado` lo que dicen las ventas, y `diferencia` la resta. Guardar
    las tres —en vez de solo la buena— es lo que permite tener la conversación
    al día siguiente; un sistema que solo guarda el número correcto no sirve
    para descubrir nada.
    """

    ubicacion = models.ForeignKey(
        "inventory.Ubicacion", on_delete=models.PROTECT, related_name="turnos"
    )

    usuario_apertura = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="turnos_abiertos",
    )
    usuario_cierre = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="turnos_cerrados",
    )

    fondo_inicial = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    #: Lo que contó la persona al cerrar. Puede no cuadrar, y ese es el punto.
    total_declarado = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    #: Lo que dicen las ventas: fondo + cobros en efectivo.
    total_calculado = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    diferencia = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    nota_cierre = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "pos_turno"
        verbose_name = "Turno de caja"
        verbose_name_plural = "Turnos de caja"
        ordering = ["-fecha_apertura"]
        constraints = [
            # Dos turnos abiertos en la misma caja dejarían a suerte de la
            # consulta en cuál cae cada venta, y ninguno de los dos cuadraría.
            models.UniqueConstraint(
                fields=["tenant", "ubicacion"],
                condition=models.Q(fecha_cierre__isnull=True),
                name="pos_un_turno_abierto_por_ubicacion",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "-fecha_apertura"], name="pos_turno_fecha_idx"),
        ]

    def __str__(self):
        estado = "abierto" if self.esta_abierto else "cerrado"
        return f"Turno #{self.pk} · {self.ubicacion} ({estado})"

    @property
    def esta_abierto(self) -> bool:
        return self.fecha_cierre is None


# ==========================================================================
# 3. VENTA
# ==========================================================================
class Venta(ModeloConTenant):
    """
    Una venta de mostrador.

    `numero` es consecutivo POR TURNO, no por negocio. Es deliberado y conviene
    justificarlo: numerar por negocio obligaría a serializar todas las cajas
    entre sí para no repetir número, y dos mostradores del mismo local se
    bloquearían el uno al otro en la hora punta. El turno es la granularidad
    natural del contador —igual que la categoría lo es del código de producto—
    y basta para encontrar una venta: «turno 12, venta 34».

    Esto NO es numeración fiscal. Ver el encabezado del módulo.

    `contexto` es lo que aporta el módulo que originó la venta: `{"mesa": 7}`
    de reservas, `{"domicilio": 12}` de delivery. El POS no sabe qué es una
    mesa; sabe que hay un panel registrado que le devuelve un diccionario y lo
    adjunta. Ese es el mecanismo que permite añadir un tipo de negocio sin
    volver a tocar la caja.
    """

    class Estado(models.TextChoices):
        ABIERTA = "ABIERTA", "En curso"
        PAGADA = "PAGADA", "Pagada"
        ANULADA = "ANULADA", "Anulada"

    turno = models.ForeignKey(Turno, on_delete=models.PROTECT, related_name="ventas")
    tenant_heredado_de = "turno"

    numero = models.PositiveIntegerField()
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.ABIERTA
    )

    cliente = models.ForeignKey(
        "orders.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ventas"
    )

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    contexto = models.JSONField(default=dict, blank=True)
    nota = models.CharField(max_length=255, blank=True)

    fecha = models.DateTimeField(auto_now_add=True)
    fecha_pago = models.DateTimeField(null=True, blank=True)
    anulada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas_anuladas",
    )
    motivo_anulacion = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "pos_venta"
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"
        ordering = ["-fecha"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "turno", "numero"],
                name="pos_un_numero_por_turno",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "estado", "-fecha"], name="pos_venta_estado_idx"),
        ]

    def __str__(self):
        return f"Venta T{self.turno_id}-{self.numero:03d}"

    @property
    def pagado(self) -> Decimal:
        return sum((p.importe for p in self.pagos.all()), Decimal("0"))

    @property
    def pendiente(self) -> Decimal:
        return self.total - self.pagado


# ==========================================================================
# 4. LÍNEA DE VENTA
# ==========================================================================
class LineaVenta(ModeloConTenant):
    """
    Un renglón, congelado tal como se vendió.

    `nombre_congelado`, `precio_unitario` y `atributos` son COPIAS del momento
    de la venta, no lecturas por clave foránea. Es la misma regla que ya
    aplican `VersionPagina` con la composición publicada y `DetallePedido` con
    su nombre: lo histórico no puede cambiar porque alguien renombrara un
    producto o le subiera el precio seis meses después.

    La presentación se guarda igual, y con `PROTECT`: sirve para saber qué se
    vendió exactamente y para devoluciones, y borrarla dejaría el histórico
    mintiendo sobre lo que salió del inventario.
    """

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="lineas")
    tenant_heredado_de = "venta"

    presentacion = models.ForeignKey(
        "catalog.PresentacionProducto", on_delete=models.PROTECT, related_name="lineas_venta"
    )

    nombre_congelado = models.CharField(max_length=255)
    cantidad = models.DecimalField(
        max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))]
    )
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    #: Lo que distinguía a esta presentación: {"talla": "M"}. Copiado, no
    #: referenciado: si el negocio cambia sus ejes de atributos mañana, la
    #: venta de hoy tiene que seguir diciendo lo que se vendió.
    atributos = models.JSONField(default=dict, blank=True)
    nota = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "pos_lineaventa"
        verbose_name = "Línea de venta"
        verbose_name_plural = "Líneas de venta"
        ordering = ["id"]
        indexes = [models.Index(fields=["venta"])]

    def __str__(self):
        return f"{self.cantidad} x {self.nombre_congelado}"

    def save(self, *args, **kwargs):
        if not self.nombre_congelado and self.presentacion_id:
            self.nombre_congelado = (
                f"{self.presentacion.producto.nombre_producto} "
                f"({self.presentacion.nombre_presentacion})"
            )
        if not self.precio_unitario and self.presentacion_id:
            self.precio_unitario = self.presentacion.precio_unitario
        self.subtotal = (self.cantidad or Decimal("0")) * (
            self.precio_unitario or Decimal("0")
        )
        super().save(*args, **kwargs)


# ==========================================================================
# 5. PAGO
# ==========================================================================
class Pago(ModeloConTenant):
    """
    Cuánto se pagó con cada medio.

    Es una tabla y no dos columnas en la venta porque el pago partido es la
    norma y no la excepción: la mitad en efectivo y la mitad con tarjeta pasa
    todos los días. Con columnas habría que inventar `medio_2`, `importe_2`, y
    al tercero rehacerlo.
    """

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="pagos")
    tenant_heredado_de = "venta"

    medio = models.ForeignKey(MedioPago, on_delete=models.PROTECT, related_name="pagos")
    importe = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    #: Número de aprobación, comprobante, últimos dígitos. Lo que haga falta
    #: para encontrar el cobro en el extracto del banco.
    referencia = models.CharField(max_length=80, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pos_pago"
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"
        ordering = ["id"]
        indexes = [models.Index(fields=["venta"])]

    def __str__(self):
        return f"{self.medio} · {self.importe}"

    def clean(self):
        super().clean()
        if self.importe is not None and self.importe <= 0:
            raise ValidationError({"importe": "Un pago de cero no es un pago."})
