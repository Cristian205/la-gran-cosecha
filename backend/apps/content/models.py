from django.db import models


class SiteConfig(models.Model):
    """
    Configuración única del sitio (logo, contacto, textos institucionales y
    datos del emisor de factura). Se fuerza a un solo registro (pk=1) con
    el patrón get_solo().
    """

    logo = models.ImageField(upload_to="site/", blank=True, null=True)
    nombre_empresa = models.CharField(max_length=150, blank=True)

    # Apariencia
    color_primario = models.CharField(max_length=7, blank=True, default="#16a34a")

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
        verbose_name = "Configuración del sitio"
        verbose_name_plural = "Configuración del sitio"

    def __str__(self):
        return "Configuración del sitio"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # El singleton no se borra

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class PromoBanner(models.Model):
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


class Testimonio(models.Model):
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


class TrustBadge(models.Model):
    ICONOS = [
        ("leaf", "Hoja"),
        ("truck", "Camión"),
        ("shield", "Escudo"),
        ("users", "Usuarios"),
    ]

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
