from django.db import models


class Notificacion(models.Model):
    """
    Centro de notificaciones interno del panel administrativo. Por ahora es
    global (visible para todo el staff) en vez de por usuario: el equipo que
    usa el panel es pequeño y comparte la misma bandeja, igual que ya ocurre
    con SiteConfig como configuración única.
    """

    TIPOS = [
        ("PEDIDO_NUEVO", "Nuevo pedido"),
        ("CLIENTE_NUEVO", "Nuevo cliente"),
        ("PRODUCTO_PERSONALIZADO", "Producto personalizado"),
        ("SISTEMA", "Sistema / plataforma"),
    ]

    tipo = models.CharField(max_length=30, choices=TIPOS)
    titulo = models.CharField(max_length=200)
    mensaje = models.TextField(blank=True)
    enlace = models.CharField(max_length=255, blank=True)
    leida = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_notificacion"
        ordering = ["-fecha_creacion"]
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"

    def __str__(self):
        return self.titulo
