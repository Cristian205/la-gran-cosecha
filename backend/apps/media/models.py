from django.conf import settings
from django.db import models


class Archivo(models.Model):
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

    archivo = models.FileField(upload_to="biblioteca/%Y/%m/")
    nombre_original = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    content_type = models.CharField(max_length=100)
    tamano = models.PositiveIntegerField(help_text="Tamaño en bytes")
    ancho = models.PositiveIntegerField(null=True, blank=True)
    alto = models.PositiveIntegerField(null=True, blank=True)

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
