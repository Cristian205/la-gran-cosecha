"""Un negocio nuevo nace con plan."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.tenancy.models import Tenant

from .models import Plan, Subscription


@receiver(post_save, sender=Tenant)
def suscribir_al_plan_por_defecto(sender, instance, created, **kwargs):
    """
    Sin esto, una empresa recién dada de alta no podría repartir ni un permiso
    entre su gente: el catálogo que ve cada negocio depende de su plan, y sin
    suscripción ese catálogo está vacío. El alta quedaría a medias sin que
    nadie entendiera por qué.

    Para eso existe `Plan.es_predeterminado`, que la base garantiza único.
    """
    if not created:
        return

    por_defecto = Plan.objects.filter(es_predeterminado=True, activo=True).first()
    if por_defecto is None:
        # Instalación sin planes todavía (por ejemplo, durante las migraciones
        # que crean el primer negocio). La siembra de billing los suscribe.
        return

    Subscription.objects.get_or_create(
        tenant=instance, defaults={"plan": por_defecto, "estado": "PRUEBA"}
    )
