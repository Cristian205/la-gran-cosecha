"""Un negocio nuevo nace con plan."""
from datetime import timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.tenancy.models import Tenant

from .models import EstadoComercial, Plan, Subscription


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

    por_defecto = Plan.objects.filter(
        es_predeterminado=True, estado=EstadoComercial.ACTIVO
    ).first()
    if por_defecto is None:
        # Instalación sin planes todavía (por ejemplo, durante las migraciones
        # que crean el primer negocio). La siembra de billing los suscribe.
        return

    # La prueba gratuita se fecha al crear la suscripción y no se calcula al
    # leerla: si el plan cambia de 14 a 30 días mañana, los clientes que ya
    # estaban en prueba no deberían ver moverse su fecha de vencimiento.
    fin_prueba = (
        timezone.localdate() + timedelta(days=por_defecto.trial_dias)
        if por_defecto.trial_dias
        else None
    )

    Subscription.objects.get_or_create(
        tenant=instance,
        defaults={
            "plan": por_defecto,
            "estado": "PRUEBA",
            "fecha_fin_prueba": fin_prueba,
        },
    )
