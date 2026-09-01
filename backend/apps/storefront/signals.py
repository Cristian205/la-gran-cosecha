"""Una tienda nueva nace con su página de inicio."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.tenancy.context import usar_tenant
from apps.tenancy.models import Tenant

from .composicion import adoptar_plantilla
from .models import Pagina, Plantilla


@receiver(post_save, sender=Tenant)
def sembrar_tienda_inicial(sender, instance, created, **kwargs):
    """
    Sin esto, un negocio recién dado de alta tendría la tienda en blanco.

    Antes del motor, el inicio estaba escrito en `HomePage.tsx` y aparecía solo;
    ahora la composición son datos, y unos datos que nadie crea no existen. Es
    el mismo problema que resuelve `suscribir_al_plan_por_defecto` en billing, y
    se resuelve igual: hay una plantilla marcada por defecto y la base garantiza
    que sea única.

    Se publica de inmediato y no se deja en borrador a propósito: una tienda
    recién creada tiene que responder algo desde el primer minuto, y pedirle a
    alguien que entre a publicar antes de que su dominio funcione sería un paso
    que nadie entiende.
    """
    if not created:
        return

    plantilla = Plantilla.objects.filter(es_predeterminada=True, activa=True).first()
    if plantilla is None:
        # Instalación sin plantillas todavía (por ejemplo, durante las
        # migraciones que crean el primer negocio). La siembra las pone.
        return

    if Pagina.all_tenants.filter(tenant=instance).exists():
        return

    # El ambito se declara aqui y no se hereda: la senal salta DENTRO del
    # `Tenant.objects.create()` que da de alta el negocio, y en ese momento
    # todavia no hay ningun `usar_tenant()` abierto. Sin esto, `Pagina.objects`
    # lanzaria `SinTenantEnContexto` y reventaria el alta entera.
    with usar_tenant(instance):
        adoptar_plantilla(instance, plantilla, publicar_ya=True)
