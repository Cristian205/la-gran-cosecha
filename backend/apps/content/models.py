from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.tenancy.models import ModeloConTenant


class StoreSettings(models.Model):
    """
    La identidad y la apariencia de una tienda: logo, colores, tipografía,
    contacto, textos institucionales y datos del emisor de la factura.

    Hasta la fase 2 era `SiteConfig`, un singleton forzado a pk=1. Ese singleton
    era el bloqueo conceptual más profundo del proyecto: toda la identidad del
    negocio vivía en una única fila, así que no había forma de que un segundo
    negocio tuviera la suya. Ahora es una fila por tenant.

    Se conserva `db_table = "content_siteconfig"` y la ruta `/api/content/
    site-config/` a propósito: renombrarlas obligaría a una migración de datos
    y a tocar el storefront sin ganar nada.
    """

    tenant = models.OneToOneField(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="settings",
        editable=False,
    )

    FUENTES = [
        ("poppins", "Poppins"),
        ("inter", "Inter"),
        ("nunito", "Nunito"),
        ("work-sans", "Work Sans"),
        ("jakarta", "Plus Jakarta Sans"),
        ("quicksand", "Quicksand"),
    ]
    RADIOS_BOTON = [
        ("redondeado", "Redondeado (píldora)"),
        ("suave", "Suave"),
        ("cuadrado", "Cuadrado"),
    ]

    logo = models.ImageField(upload_to="site/", blank=True, null=True)
    nombre_empresa = models.CharField(max_length=150, blank=True)

    # Apariencia — colores
    color_primario = models.CharField(max_length=7, blank=True, default="#16a34a")
    color_primario_texto = models.CharField(max_length=7, blank=True, default="#ffffff")
    color_secundario = models.CharField(max_length=7, blank=True, default="#f59e0b")
    color_secundario_texto = models.CharField(max_length=7, blank=True, default="#0b1f17")
    color_fondo = models.CharField(max_length=7, blank=True, default="#f6faf7")
    color_superficie = models.CharField(max_length=7, blank=True, default="#ffffff")
    color_texto = models.CharField(max_length=7, blank=True, default="#0f172a")

    # Apariencia — tipografía y forma
    fuente = models.CharField(max_length=20, choices=FUENTES, default="poppins")
    radio_boton = models.CharField(max_length=20, choices=RADIOS_BOTON, default="redondeado")

    # Apariencia — layout del navbar y buscador
    ancho_buscador = models.PositiveIntegerField(
        default=420, validators=[MinValueValidator(240), MaxValueValidator(640)]
    )
    espaciado_navbar = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(64)],
        help_text="Espacio extra (px) entre el logo y las opciones del navbar.",
    )

    # Contacto / redes
    whatsapp_numero = models.CharField(
        max_length=20, blank=True, help_text="Formato internacional sin '+', ej: 573001234567"
    )
    whatsapp_mensaje_pedido = models.TextField(
        blank=True,
        default="Hola, soy {nombre} y quiero confirmar mi pedido #{pedido_id} por un total de {total}.",
        help_text="Placeholders disponibles: {nombre}, {pedido_id}, {total}",
    )
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    tiktok_url = models.URLField(blank=True)
    telefono = models.CharField(max_length=25, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    ciudad = models.CharField(max_length=120, blank=True)
    horario = models.CharField(max_length=150, blank=True)

    # Textos de "Sobre nosotros"
    historia = models.TextField(blank=True)
    mision = models.TextField(blank=True)

    # Home — "Cómo funciona" (siempre 3 pasos fijos, por eso son campos
    # directos y no una lista administrable como Testimonios/TrustBadges).
    paso1_titulo = models.CharField(max_length=80, blank=True, default="Explora el catálogo")
    paso1_texto = models.CharField(
        max_length=200, blank=True,
        default="Filtra por categoría o busca directo lo que necesitas para tu negocio.",
    )
    paso2_titulo = models.CharField(max_length=80, blank=True, default="Arma tu pedido")
    paso2_texto = models.CharField(
        max_length=200, blank=True,
        default="Elige presentación, unidad y cantidad — hasta fraccionada si el producto lo permite.",
    )
    paso3_titulo = models.CharField(max_length=80, blank=True, default="Recibe tu entrega")
    paso3_texto = models.CharField(
        max_length=200, blank=True,
        default="Confirmamos contigo por WhatsApp y despachamos directo a tu negocio.",
    )

    # Home — Cotización rápida
    cotizacion_titulo = models.CharField(
        max_length=100, blank=True, default="¿Pedido grande o fuera de catálogo?"
    )
    cotizacion_texto = models.CharField(
        max_length=220, blank=True,
        default="Cuéntanos qué necesitas y te confirmamos precio y disponibilidad en minutos.",
    )

    # Home — CTA final
    cta_final_titulo = models.CharField(
        max_length=100, blank=True, default="Tu próximo pedido puede estar en camino hoy mismo"
    )
    cta_final_texto = models.CharField(
        max_length=220, blank=True,
        default="Explora el catálogo completo y arma tu pedido en minutos.",
    )

    # Datos del emisor para la factura en PDF
    factura_eslogan = models.CharField(
        max_length=150, blank=True, default="Distribuidora Mayorista"
    )
    factura_nit = models.CharField(max_length=50, blank=True)
    factura_proveedor = models.CharField(max_length=150, blank=True)
    factura_telefono = models.CharField(max_length=25, blank=True)
    factura_direccion = models.CharField(max_length=255, blank=True)

    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "content_siteconfig"
        verbose_name = "Configuración de la tienda"
        verbose_name_plural = "Configuración de la tienda"

    def __str__(self):
        return f"Configuración de {self.tenant or 'sin negocio'}"

    @classmethod
    def get_para(cls, tenant):
        """
        La configuración de un negocio, creándola si aún no existe.

        Sin negocio devuelve None y quien llama decide: la API responde 404, y
        la factura y el correo del OTP caen a los valores por defecto del
        modelo. Nunca adivina: hasta la fase 3 hubo un puente que, con un solo
        negocio dado de alta, asumía que era ese. Se retiró porque adivinar es
        el fallo abierto contra el que se diseñó todo el aislamiento.

        Normalmente `Tenant` ya nace con la suya (ver tenancy/signals.py); el
        `get_or_create` cubre los negocios creados antes de esa señal.
        """
        if tenant is None:
            return None
        obj, _ = cls.objects.get_or_create(tenant=tenant)
        return obj


class PromoBanner(ModeloConTenant):
    imagen = models.ImageField(upload_to="banners/", blank=True, null=True)
    etiqueta = models.CharField(max_length=100, blank=True)
    titulo = models.CharField(max_length=200)
    texto = models.TextField(blank=True)
    cta_texto = models.CharField(max_length=60, blank=True)
    cta_href = models.CharField(max_length=255, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "content_promobanner"
        ordering = ["orden", "-fecha_creacion"]
        verbose_name = "Banner de inicio"
        verbose_name_plural = "Banners de inicio"

    def __str__(self):
        return self.titulo


class Testimonio(ModeloConTenant):
    nombre = models.CharField(max_length=150)
    rol = models.CharField(max_length=150, blank=True)
    texto = models.TextField()
    estrellas = models.PositiveSmallIntegerField(default=5)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "content_testimonio"
        ordering = ["orden", "-fecha_creacion"]

    def __str__(self):
        return f"{self.nombre} ({self.rol})"


class TrustBadge(ModeloConTenant):
    ICONOS = [
        ("leaf", "Hoja"),
        ("truck", "Camión"),
        ("shield", "Escudo"),
        ("users", "Usuarios"),
    ]
    TIPOS = [
        ("insignia", "Insignia (barra de confianza, ej: 'Entrega 24-48h')"),
        ("estadistica", "Estadística (número grande, ej: '+350 productos')"),
    ]

    tipo = models.CharField(max_length=20, choices=TIPOS, default="insignia")
    icono = models.CharField(max_length=20, choices=ICONOS, default="leaf")
    valor = models.CharField(max_length=40)
    etiqueta = models.CharField(max_length=150)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "content_trustbadge"
        ordering = ["orden", "id"]
        verbose_name = "Sello de confianza"
        verbose_name_plural = "Sellos de confianza"

    def __str__(self):
        return f"{self.valor} - {self.etiqueta}"


class BeneficioComercial(ModeloConTenant):
    """Bloque de Home '¿Por qué comprar con nosotros?'."""

    ICONOS = [
        ("truck", "Camión"),
        ("clock", "Reloj"),
        ("package", "Paquete"),
        ("wallet", "Billetera"),
        ("headset", "Auriculares (atención)"),
        ("check", "Check"),
        ("shield", "Escudo"),
        ("users", "Usuarios"),
    ]

    icono = models.CharField(max_length=20, choices=ICONOS, default="check")
    titulo = models.CharField(max_length=100)
    texto = models.CharField(max_length=200, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "content_beneficiocomercial"
        ordering = ["orden", "id"]
        verbose_name = "Beneficio comercial"
        verbose_name_plural = "Beneficios comerciales"

    def __str__(self):
        return self.titulo


class OfertaProducto(ModeloConTenant):
    """
    Oferta de tiempo limitado sobre una presentación puntual del catálogo,
    para el bloque de Home "Ofertas de la semana". El precio normal se lee
    siempre de `presentacion.precio_unitario` (nunca se duplica aquí), así
    que si el precio de catálogo cambia, el % de ahorro se recalcula solo.
    """

    tenant_heredado_de = "presentacion"

    presentacion = models.ForeignKey(
        "catalog.PresentacionProducto", on_delete=models.CASCADE, related_name="ofertas"
    )
    precio_oferta = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(0)]
    )
    fecha_fin = models.DateTimeField(
        blank=True, null=True, help_text="Opcional: si se define, el Home muestra un contador."
    )
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "content_ofertaproducto"
        ordering = ["-fecha_creacion"]
        verbose_name = "Oferta de producto"
        verbose_name_plural = "Ofertas de la semana"

    def __str__(self):
        return f"Oferta: {self.presentacion} → ${self.precio_oferta}"
