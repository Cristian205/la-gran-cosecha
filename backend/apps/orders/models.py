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
    nombre_cliente = models.CharField(max_length=200)
    #: Nombre del negocio (tienda, restaurante...) por el que pide la persona.
    #: Opcional: `nombre_cliente` es siempre el de quien pide.
    negocio_cliente = models.CharField(max_length=200, blank=True, default="", db_default="")
    telefono_cliente = models.CharField(max_length=25, blank=True)
    direccion_cliente = models.TextField(blank=True)

    #: Cédula (o NIT) con la que el cliente se identifica en la tienda cuando
    #: el negocio lo pide (`StoreSettings.identificacion_clientes`). Solo
    #: dígitos. Vacía en los clientes que llegaron antes, o por la caja.
    #:
    #: Es la llave del cliente y no el nombre: dos "Juan Pérez" son dos
    #: personas, y escribir el nombre de otro no debe dar acceso a su historial.
    documento_cliente = models.CharField(max_length=20, blank=True, default="", db_default="")

    #: Cuándo aceptó que el precio final se ajusta al mercado del día. Se
    #: pide una sola vez, en su primer pedido, y ya no se vuelve a preguntar.
    acepto_precios_en = models.DateTimeField(null=True, blank=True)

    #: Cuándo autorizó el tratamiento de sus datos personales (Ley 1581 de
    #: 2012). Es la PRUEBA de la autorización que la ley exige conservar; nulo
    #: en los clientes de antes de pedirla y en los creados por la caja.
    autorizo_datos_en = models.DateTimeField(null=True, blank=True)

    #: Si acepta recibir por WhatsApp los avisos de sus pedidos. Meta exige
    #: este consentimiento antes de escribirle, y `apps.mensajeria` no le
    #: envía nada al cliente sin él (salvo que el negocio lo desactive).
    acepta_whatsapp = models.BooleanField(default=False, db_default=False)
    #: Cuándo lo decidió —aceptar o retirarlo—. Nulo = nunca se le preguntó,
    #: y es lo que hace que la tienda le pregunte.
    whatsapp_decidido_en = models.DateTimeField(null=True, blank=True)

    fecha_registro_cliente = models.DateTimeField(auto_now_add=True)

    #: Qué alertas quiere recibir: `{codigo: bool}` con los códigos de
    #: `apps/orders/alertas_cliente.py`. Solo se guarda lo que alguien cambió;
    #: lo demás toma el valor por defecto de cada alerta.
    alertas = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ui_cliente"
        ordering = ["nombre_cliente"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "documento_cliente"],
                condition=~models.Q(documento_cliente=""),
                name="orders_cliente_documento_unico_por_negocio",
            )
        ]

    @property
    def datos_completos(self) -> bool:
        """Si ya hizo su primer pedido identificado: no hay nada que volver a pedirle."""
        return bool(self.telefono_cliente and self.direccion_cliente and self.acepto_precios_en)

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

    #: Dirección solo para ESTE pedido, cuando el cliente pidió entregarlo en
    #: otro sitio. Vacía = la dirección guardada del cliente, que no cambia.
    direccion_entrega = models.TextField(blank=True, default="", db_default="")

    #: Por dónde llegó el pedido que el negocio apunta desde el panel
    #: («Registrar pedido»). Vacío en los de la tienda y en los anteriores a
    #: este campo: de esos no se sabe y no se inventa.
    CANALES = [
        ("TELEFONO", "Teléfono"),
        ("WHATSAPP", "WhatsApp"),
        ("MOSTRADOR", "Mostrador"),
    ]
    canal = models.CharField(max_length=12, choices=CANALES, blank=True, default="", db_default="")

    # ---- Logística que anota el negocio --------------------------------
    #
    # Lo que escribió el cliente (`observaciones`, `direccion_entrega` y los
    # datos de su ficha) es lo que pidió y no se reescribe desde el panel por
    # la puerta de atrás: lo que el negocio añade va en campos propios.

    #: Teléfono solo para esta entrega. Vacío = el del cliente.
    telefono_entrega = models.CharField(max_length=25, blank=True, default="", db_default="")
    #: Quién recibe, cuando no es el titular («la portería», «Doña Marta»).
    recibe_nombre = models.CharField(max_length=150, blank=True, default="", db_default="")
    #: Cuándo se va a llevar. Nulo = sin programar (la factura asume el día
    #: siguiente al pedido, como siempre).
    fecha_programada = models.DateTimeField(null=True, blank=True)
    #: Indicaciones para quien reparte («timbre dañado, llamar al llegar»).
    indicaciones_entrega = models.TextField(blank=True, default="", db_default="")
    #: Notas del equipo. Nunca se le muestran al cliente.
    notas_internas = models.TextField(blank=True, default="", db_default="")

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
        indexes = [
            models.Index(fields=["tenant", "estado"], name="ui_pedido_tenant_estado_idx"),
            # Toda la analítica del dashboard filtra por rango de `fecha_pedido`
            # dentro del negocio; sin este índice cada consulta recorre todos
            # los pedidos del negocio para quedarse con un mes.
            models.Index(fields=["tenant", "fecha_pedido"], name="ui_pedido_tenant_fecha_idx"),
        ]

    @property
    def direccion_de_entrega(self) -> str:
        """A dónde se lleva: la de este pedido si la hay, si no la del cliente."""
        if self.direccion_entrega:
            return self.direccion_entrega
        return self.cliente.direccion_cliente if self.cliente else ""

    @property
    def telefono_de_contacto(self) -> str:
        """A qué número se llama para entregar: el de este pedido o el del cliente."""
        if self.telefono_entrega:
            return self.telefono_entrega
        return self.cliente.telefono_cliente if self.cliente else ""

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

    # Cómo se llamaba el producto cuando se vendió.
    #
    # El precio ya se congelaba —ver `save()`—, pero el nombre no: se leía por
    # la clave foránea, así que renombrar un producto reescribía en silencio
    # todas las facturas viejas que lo contenían. Una factura de hace seis meses
    # no puede cambiar porque hoy alguien corrigiera una tilde.
    #
    # Es el mismo criterio de instantánea que `VersionPagina` aplica a la
    # composición publicada, y por la misma razón: lo histórico se guarda como
    # copia, nunca como referencia.
    nombre_congelado = models.CharField(max_length=255, blank=True)
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

    # ---- Trazabilidad del contenido original ---------------------------
    ORIGENES = [
        ("CLIENTE", "Solicitado por el cliente"),
        ("ADMIN", "Agregado por el negocio"),
    ]
    #: Quién puso esta línea en el pedido. Las anteriores a este campo se
    #: asumen del cliente: es lo único que entraba por la tienda.
    origen = models.CharField(
        max_length=10, choices=ORIGENES, default="CLIENTE", db_default="CLIENTE"
    )
    agregado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    #: Lo que pidió el cliente, congelado al crear la línea. La edición cambia
    #: `cantidad` y `precio_unitario`; estos dos no se tocan nunca, para que
    #: siempre se pueda ver qué se pidió frente a qué se entregó.
    cantidad_original = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    precio_original = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    #: Observación de la línea («maduros para el viernes», «sin hojas»).
    nota = models.TextField(blank=True, default="", db_default="")

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
        if self.pk is None and self.presentacion and self.origen == "CLIENTE":
            # Lo que pide el cliente se cobra al precio del catálogo, diga lo
            # que diga el carrito. Una línea que agrega el negocio, en cambio,
            # lleva el precio que el negocio decidió al agregarla.
            self.precio_unitario = self.presentacion.precio_unitario
        if self.pk is None and self.origen == "CLIENTE" and self.cantidad_original is None:
            self.cantidad_original = self.cantidad
            self.precio_original = self.precio_unitario
        if not self.nombre_congelado:
            self.nombre_congelado = self.descripcion_actual()
        self.subtotal = self.calcular_subtotal()
        super().save(*args, **kwargs)

    def descripcion_actual(self) -> str:
        """Cómo se llama hoy lo que hay en esta línea, mire donde mire."""
        if self.presentacion_id:
            presentacion = self.presentacion
            return (
                f"{presentacion.producto.nombre_producto} "
                f"({presentacion.nombre_presentacion})"
            )
        return self.nombre_personalizado or ""

    def __str__(self):
        # El nombre congelado va primero: es cómo se vendió, que es lo que
        # cuenta en una factura o en un histórico.
        return f"{self.cantidad} x {self.nombre_congelado or self.descripcion_actual()}"


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
# 4b. EVENTOS DEL PEDIDO (línea de tiempo)
# ==========================================================================
class EventoPedido(ModeloConTenant):
    """
    Lo que le pasó a un pedido, en orden: la auditoría que ve el panel.

    `HistorialDetallePedido` cuelga de la LÍNEA y se borra en cascada con
    ella, así que quitar un producto borraba también la prueba de que estuvo.
    Este registro cuelga del PEDIDO y guarda en `datos` una copia de lo que
    había (nombre, cantidad, precio): sobrevive a la línea y a los cambios del
    catálogo. Solo se añade; nunca se edita.
    """

    tenant_heredado_de = "pedido"

    TIPOS = [
        ("RECIBIDO", "Pedido recibido"),
        ("PRODUCTO_AGREGADO", "Producto agregado"),
        ("PRODUCTO_ELIMINADO", "Producto eliminado"),
        ("CANTIDAD", "Cambio de cantidad"),
        ("PRECIO", "Cambio de precio"),
        ("PRESENTACION", "Cambio de presentación"),
        ("PRODUCTO_EDITADO", "Producto editado"),
        ("ENTREGA", "Datos de entrega"),
        ("NOTAS", "Notas internas"),
        ("ESTADO", "Cambio de estado"),
        ("FACTURA", "Factura generada"),
        ("CATALOGO", "Revisión de producto sugerido"),
    ]

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=24, choices=TIPOS)
    descripcion = models.CharField(max_length=300)
    datos = models.JSONField(default=dict, blank=True)
    #: Nulo = lo hizo el cliente desde la tienda, o el sistema.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ui_eventopedido"
        ordering = ["-fecha", "-id"]
        indexes = [models.Index(fields=["pedido", "fecha"], name="ui_evento_pedido_fecha_idx")]

    def __str__(self):
        return f"Pedido #{self.pedido_id} · {self.get_tipo_display()}"


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
