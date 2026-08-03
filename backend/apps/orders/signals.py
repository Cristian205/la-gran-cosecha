from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.models import Notificacion

from .models import Cliente, DetallePedido, Pedido


@receiver(post_save, sender=Cliente)
def notificar_cliente_nuevo(sender, instance, created, **kwargs):
    if not created:
        return
    Notificacion.objects.create(
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
        tipo="PRODUCTO_PERSONALIZADO",
        titulo=f"Producto nuevo sugerido: {instance.nombre_personalizado}",
        mensaje=f"Categoría: {categoria} · Pedido #{instance.pedido_id}",
        enlace="/productos-pendientes",
    )
