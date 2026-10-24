from django.conf import settings
from django.db import models

from apps.tenancy.almacenamiento import ruta_biblioteca
from apps.tenancy.models import ModeloConTenant


class Archivo(ModeloConTenant):
    """
    Biblioteca de medios (banco de archivos) al estilo WordPress/Shopify:
    repositorio central de imágenes/video/PDF reutilizable desde cualquier
    formulario del panel (producto, banner, logo, etc.) sin tener que volver
    a subir el mismo archivo cada vez.
    """

    TIPOS = [
        ("IMAGEN", "Imagen"),
        ("VIDEO", "Video"),
        ("DOCUMENTO", "Documento"),
    ]

    archivo = models.FileField(upload_to=ruta_biblioteca)
    nombre_original = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    content_type = models.CharField(max_length=100)
    tamano = models.PositiveIntegerField(help_text="Tamaño en bytes")
    ancho = models.PositiveIntegerField(null=True, blank=True)
    alto = models.PositiveIntegerField(null=True, blank=True)

    # Lo que dejó el optimizador (apps/media/optimizador.py). Vacío en videos,
    # PDF, SVG y en lo subido antes de que existiera.
    CALIDADES = [
        ("BUENA", "Buena"),
        ("ACEPTABLE", "Aceptable"),
        ("BAJA", "Baja: pixelada, borrosa o pequeña"),
    ]
    calidad = models.CharField(max_length=10, choices=CALIDADES, blank=True, default="")
    diagnostico = models.JSONField(default=dict, blank=True)
    tamano_original = models.PositiveIntegerField(
        null=True, blank=True, help_text="Bytes del archivo tal como se subió, antes de optimizarlo."
    )

    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_archivo"
        ordering = ["-fecha_creacion"]
        verbose_name = "Archivo"
        verbose_name_plural = "Archivos"
        indexes = [models.Index(fields=["tipo"])]

    def __str__(self):
        return self.nombre_original
