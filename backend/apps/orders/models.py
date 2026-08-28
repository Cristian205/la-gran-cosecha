from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# 1. CLIENTE
# ==========================================================================
class Cliente(ModeloConTenant):
    # La unicidad pasa a ser (tenant, nombre): "Juan Pérez" puede ser cliente
    # de dos negocios distintos sin que uno vea al del otro.
    nombre_cliente = models.CharField(max_length=200)
    telefono_cliente = models.CharField(max_length=25, blank=True)
    direccion_cliente = models.TextField(blank=True)

    fecha_registro_cliente = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ui_cliente"
        ordering = ["nombre_cliente"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "nombre_cliente"], name="orders_cliente_unico_por_negocio"
            )
        ]

    def __str__(self):
        return self.nombre_cliente


# ==========================================================================
# 2. PEDIDO
# ==========================================================================
class Pedido(ModeloConTenant):
    ESTADOS = [
        ("PENDIENTE", "Pendiente"),
        ("EDITADO", "Editado"),
        ("CERRADO", "Cerrado"),
        ("ENTREGADO", "Entregado"),
        ("IMPRESO", "Impreso"),
    ]

    fecha_pedido = models.DateTimeField(auto_now_add=True)

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="pedidos",
        null=True,
        blank=True,
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pedidos_realizados",
        null=True,
        blank=True,
    )

    estado = models.CharField(max_length=20, choices=ESTADOS, default="PENDIENTE")
    total_pedido = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    observaciones = models.TextField(blank=True, null=True)

    fecha_modificacion = models.DateTimeField(auto_now=True, null=True, blank=True)
    editado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="pedidos_editados",
    )

    class Meta:
        db_table = "ui_pedido"
        ordering = ["fecha_pedido"]
        indexes = [models.Index(fields=["tenant", "estado"], name="ui_pedido_tenant_estado_idx")]

    def actualizar_total(self):
        total = self.detalles.aggregate(total=Sum("subtotal"))["total"] or Decimal("0.00")
        self.total_pedido = total
        self.save(update_fields=["total_pedido"])

    def __str__(self):
        nombre = self.cliente.nombre_cliente if self.cliente else "Registro Corrupto"
        return f"Pedido #{self.id} - {nombre}"


# ==========================================================================
# 3. DETALLE PEDIDO
# ==========================================================================
class DetallePedido(ModeloConTenant):
    tenant_heredado_de = "pedido"

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="detalles")

    presentacion = models.ForeignKey(
        "catalog.PresentacionProducto",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    unidad_personalizada = models.ForeignKey(
        "catalog.UnidadMedida", on_delete=models.PROTECT, null=True, blank=True
    )
    nombre_personalizado = models.CharField(max_length=255, null=True, blank=True)

    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    subtotal = models.DecimalField(
        max_digits=12, decimal_places=2, editable=False, default=Decimal("0.00")
    )

    es_catalogo = models.BooleanField(default=False)
    categoria_manual = models.ForeignKey(
        "catalog.Categoria", null=True, blank=True, on_delete=models.SET_NULL
    )

    estado_revision = models.CharField(
        max_length=20,
        choices=[
            ("PENDIENTE", "Pendiente"),
            ("ACEPTADO", "Aceptado"),
            ("RECHAZADO", "Rechazado"),
        ],
        default="PENDIENTE",
    )
    producto_generado = models.ForeignKey(
        "catalog.Producto",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="generado_desde_pedido",
    )

    fecha_modificacion = models.DateTimeField(auto_now=True)
    modificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT
    )
    fue_modificado = models.BooleanField(default=False)

    class Meta:
        db_table = "ui_detallepedido"
        verbose_name = "Detalle de Pedido"
        verbose_name_plural = "Detalles de Pedidos"
        indexes = [
            models.Index(fields=["pedido"]),
            models.Index(fields=["tenant"], name="ui_detallep_tenant_idx"),
        ]

    def clean(self):
        super().clean()
        if not self.presentacion and not self.nombre_personalizado:
            raise ValidationError(
                "Debes seleccionar un producto o escribir uno personalizado."
            )
        if self.presentacion and self.nombre_personalizado:
            raise ValidationError(
                "No puedes mezclar producto de catálogo con personalizado."
            )
        if self.cantidad is None or self.cantidad <= 0:
            raise ValidationError("La cantidad debe ser mayor a 0.")

    def calcular_subtotal(self):
        return (self.cantidad or Decimal("0")) * (self.precio_unitario or Decimal("0"))

    def save(self, *args, **kwargs):
        self.full_clean()
        if self.pk is None and self.presentacion:
            self.precio_unitario = self.presentacion.precio_unitario
        self.subtotal = self.calcular_subtotal()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.presentacion:
            return f"{self.cantidad} x {self.presentacion.producto.nombre_producto}"
        return f"{self.cantidad} x {self.nombre_personalizado} (Manual)"


# ==========================================================================
# 4. HISTORIAL DETALLE PEDIDO
# ==========================================================================
class HistorialDetallePedido(ModeloConTenant):
    tenant_heredado_de = "detalle"

    detalle = models.ForeignKey(
        DetallePedido, on_delete=models.CASCADE, related_name="historial"
    )
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    fecha = models.DateTimeField(auto_now_add=True)
    campo = models.CharField(max_length=100)
    valor_anterior = models.TextField()
    valor_nuevo = models.TextField()
    motivo = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ui_historialdetallepedido"


# ==========================================================================
# 5. DETALLE PEDIDO MANUAL
# ==========================================================================
class DetallePedidoManual(ModeloConTenant):
    tenant_heredado_de = "pedido"

    pedido = models.ForeignKey(
        Pedido, on_delete=models.CASCADE, related_name="detalle_manual"
    )
    descripcion = models.CharField(max_length=300)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    unidad = models.CharField(max_length=50, blank=True, null=True)
    detalle_adicional = models.TextField(blank=True, null=True)
    estado = models.CharField(
        max_length=20,
        choices=[
            ("PENDIENTE", "Pendiente"),
            ("CONVERTIDO", "Convertido a catálogo"),
            ("DESCARTADO", "Descartado"),
        ],
        default="PENDIENTE",
    )
    producto_catalogo = models.ForeignKey(
        "catalog.Producto",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="productos_convertidos",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ui_detallepedidomanual"

    def __str__(self):
        return self.descripcion


# ==========================================================================
# 6. LOTE DE PEDIDOS
# ==========================================================================
class LotePedidos(ModeloConTenant):
    """
    Agrupación persistente de pedidos procesados juntos (impresión masiva o
    entrega masiva), para poder consultar después qué se procesó, quién y
    cuándo — la trazabilidad que antes se perdía al ser una acción ad-hoc.
    """

    TIPOS = [
        ("IMPRESION", "Impresión"),
        ("ENTREGA", "Entrega"),
    ]

    tipo = models.CharField(max_length=20, choices=TIPOS)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="lotes_generados"
    )
    pedidos = models.ManyToManyField(Pedido, related_name="lotes")
    cantidad_pedidos = models.PositiveIntegerField(default=0)
    total_lote = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ui_lotepedidos"
        verbose_name_plural = "Lotes de Pedidos"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"Lote #{self.id} ({self.get_tipo_display()}) - {self.cantidad_pedidos} pedidos"
