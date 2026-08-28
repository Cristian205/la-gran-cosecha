"""
Invalidación del caché de dominios.

Sin esto, conectar o mover un dominio tardaría hasta cinco minutos en surtir
efecto — y en el caso de un traslado entre negocios, ese hueco serviría el
catálogo equivocado.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .middleware import limpiar_cache_de_dominio
from .models import Domain, Tenant


@receiver(post_save, sender=Domain)
@receiver(post_delete, sender=Domain)
def invalidar_cache_de_dominio(sender, instance, **kwargs):
    limpiar_cache_de_dominio(instance.hostname)


@receiver(post_save, sender=Tenant)
def crear_configuracion_de_tienda(sender, instance, created, **kwargs):
    """
    Un negocio nace con su configuración de tienda.

    Sin esto, `tenant.settings` no existiría hasta que alguien abriera el panel
    de apariencia, y la tienda pública respondería 404 a un negocio recién
    creado. Los valores por defecto del modelo ya son un tema completo y
    utilizable.
    """
    if not created:
        return
    from apps.content.models import StoreSettings  # noqa: PLC0415

    StoreSettings.objects.get_or_create(tenant=instance)
