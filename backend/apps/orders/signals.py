"""
Notificaciones automáticas del panel.

Cada notificación hereda el tenant del objeto que la dispara, y no el del
contexto de la petición: una señal puede ejecutarse dentro de un comando, de
una tarea de fondo o de una migración, donde no hay petición de la que heredar.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.models import Notificacion

from .models import Cliente, DetallePedido, Pedido


@receiver(post_save, sender=Cliente)
def notificar_cliente_nuevo(sender, instance, created, **kwargs):
    if not created:
        return
    Notificacion.objects.create(
        tenant=instance.tenant,
        tipo="CLIENTE_NUEVO",
        titulo=f"Nuevo cliente: {instance.nombre_cliente}",
        enlace="/clientes",
    )


@receiver(post_save, sender=Pedido)
def notificar_pedido_nuevo(sender, instance, created, **kwargs):
    if not created:
        return
    nombre = instance.cliente.nombre_cliente if instance.cliente else "cliente sin registrar"
    Notificacion.objects.create(
        tenant=instance.tenant,
        tipo="PEDIDO_NUEVO",
        titulo=f"Nuevo pedido de {nombre}",
        mensaje=f"Pedido #{instance.id}",
        enlace="/pedidos",
    )


@receiver(post_save, sender=DetallePedido)
def notificar_producto_personalizado(sender, instance, created, **kwargs):
    if not created or instance.es_catalogo:
        return
    categoria = (
        instance.categoria_manual.nombre_categoria
        if instance.categoria_manual
        else "sin categoría"
    )
    Notificacion.objects.create(
        tenant=instance.tenant,
        tipo="PRODUCTO_PERSONALIZADO",
        titulo=f"Producto nuevo sugerido: {instance.nombre_personalizado}",
        mensaje=f"Categoría: {categoria} · Pedido #{instance.pedido_id}",
        enlace="/productos-pendientes",
    )
