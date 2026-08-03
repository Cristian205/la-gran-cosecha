from django.db import models


class MensajeContacto(models.Model):
    nombre = models.CharField(max_length=200)
    email = models.EmailField()
    telefono = models.CharField(max_length=25, blank=True)
    mensaje = models.TextField()

    atendido = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_mensajecontacto"
        ordering = ["-fecha_creacion"]
        verbose_name = "Mensaje de contacto"
        verbose_name_plural = "Mensajes de contacto"

    def __str__(self):
        return f"{self.nombre} - {self.fecha_creacion:%Y-%m-%d}"
