"""
Invalidación del caché de dominios.

Sin esto, conectar o mover un dominio tardaría hasta cinco minutos en surtir
efecto — y en el caso de un traslado entre negocios, ese hueco serviría el
catálogo equivocado.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .middleware import limpiar_cache_de_dominio
from .models import Domain


@receiver(post_save, sender=Domain)
@receiver(post_delete, sender=Domain)
def invalidar_cache_de_dominio(sender, instance, **kwargs):
    limpiar_cache_de_dominio(instance.hostname)
