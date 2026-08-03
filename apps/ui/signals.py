from decimal import Decimal
from django.db.models import Sum
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import DetallePedido


def actualizar_total_pedido(pedido):
    total = pedido.detalles.aggregate(
        total=Sum("subtotal")
    )["total"] or Decimal("0.00")

    pedido.total_pedido = total
    pedido.save(update_fields=["total_pedido"])


@receiver(post_save, sender=DetallePedido)
def detalle_guardado(sender, instance, **kwargs):
    actualizar_total_pedido(instance.pedido)


@receiver(post_delete, sender=DetallePedido)
def detalle_eliminado(sender, instance, **kwargs):
    actualizar_total_pedido(instance.pedido)