from django.db import models

from apps.tenancy.models import CampoTenantMixin


class Notificacion(CampoTenantMixin):
    """
    Centro de notificaciones interno del panel administrativo.

    Compartido por todo el staff de un mismo negocio, pero ya no global: hasta
    la fase 2 lo era por diseño, y con dos negocios eso significaba que un
    pedido de la perfumería aparecía en la bandeja de La Gran Cosecha.
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
