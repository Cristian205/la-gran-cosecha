"""Un negocio nace con perfil, aunque todavia no haya elegido preset."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.tenancy.models import Tenant

from .capacidades import normalizar, normalizar_politica
from .models import PerfilNegocio


@receiver(post_save, sender=Tenant)
def crear_perfil(sender, instance, created, **kwargs):
    """
    Sin esto, `tenant.perfil` no existiria hasta que alguien completara el alta
    guiada, y cada consumidor —el catalogo, los pedidos, la tienda— tendria que
    defenderse de su ausencia por separado. Uno de ellos se olvidaria.

    Nace con las capacidades por defecto, que son un negocio utilizable: acepta
    pedidos, no lleva inventario, no vende por peso. Es exactamente como se
    comportaba la plataforma antes de que el perfil existiera, asi que dar de
    alta un negocio sigue funcionando igual mientras nadie elija preset.
    """
    if not created:
        return
    PerfilNegocio.objects.get_or_create(
        tenant=instance,
        defaults={
            "capacidades": normalizar(None),
            "politica_stock": normalizar_politica(None),
        },
    )
