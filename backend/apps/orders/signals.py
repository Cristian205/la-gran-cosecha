"""
Notificaciones automáticas del panel.

Cada notificación hereda el tenant del objeto que la dispara, y no el del
contexto de la petición: una señal puede ejecutarse dentro de un comando, de
una tarea de fondo o de una migración, donde no hay petición de la que heredar.

Por eso se escribe con `all_tenants` y un `tenant=` explícito: el negocio ya
está determinado por el objeto de origen, así que exigir además un contexto
declarado solo haría fallar la señal en esos casos.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.notifications.models import Notificacion

from .inventario import liberar_pedido
from .models import Cliente, DetallePedido, Pedido


@receiver(post_save, sender=Cliente)
def notificar_cliente_nuevo(sender, instance, created, **kwargs):
    if not created:
        return
    Notificacion.all_tenants.create(
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
    Notificacion.all_tenants.create(
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
    Notificacion.all_tenants.create(
        tenant=instance.tenant,
        tipo="PRODUCTO_PERSONALIZADO",
        titulo=f"Producto nuevo sugerido: {instance.nombre_personalizado}",
        mensaje=f"Categoría: {categoria} · Pedido #{instance.pedido_id}",
        enlace="/productos-pendientes",
    )


@receiver(post_delete, sender=Pedido)
def devolver_reserva_al_borrar(sender, instance, **kwargs):
    """
    Un pedido borrado devuelve al catálogo lo que tenía apartado.

    Va en `post_delete` y no en la vista porque un pedido se borra desde varios
    sitios —la API, el admin de Django, un comando— y lo que no se puede es que
    la mercancía quede apartada para siempre a nombre de algo que ya no existe.

    Funciona después del borrado porque `liberar_pedido` no lee las líneas: lee
    los movimientos que este pedido escribió, y esos sobreviven. Es la ventaja
    de que el origen sea una referencia floja y no una clave foránea en cascada.
    """
    liberar_pedido(instance)
