"""
Hace asignable «Crear productos y aprobar los pendientes» (`catalog.add_producto`).

El backend ya lo exige para aprobar un producto pendiente (lo que un cliente
pidió fuera del catálogo y el negocio decide sumar), pero no estaba en el
catálogo de permisos: solo el dueño podía aprobar, y no había forma de
delegarlo. Va en el mismo producto que el resto de permisos del Catálogo, y
se suma a los planes que ya conceden editar productos —es el mismo módulo; no
abre nada que el plan no venda ya—.
"""
from django.db import migrations

CODENAME = "catalog.add_producto"
HERMANO = "catalog.change_producto"


def dar_de_alta(apps, schema_editor):
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")

    hermano = PermisoDisponible.objects.filter(codename=HERMANO).first()
    if hermano is None:
        return  # base sin catálogo sembrado: nada que completar
    PermisoDisponible.objects.get_or_create(
        codename=CODENAME,
        defaults={
            "producto_id": hermano.producto_id,
            "modulo": hermano.modulo,
            "etiqueta": "Crear productos y aprobar los pendientes",
            "descripcion": "Sumar al catálogo lo que un cliente pidió fuera de él.",
            "orden": max(hermano.orden - 1, 0),
        },
    )
    for plan in Plan.objects.all():
        permisos = list(plan.permisos or [])
        if HERMANO in permisos and CODENAME not in permisos:
            plan.permisos = permisos + [CODENAME]
            plan.save(update_fields=["permisos"])


def retirar(apps, schema_editor):
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")
    for plan in Plan.objects.all():
        if CODENAME in (plan.permisos or []):
            plan.permisos = [c for c in plan.permisos if c != CODENAME]
            plan.save(update_fields=["permisos"])
    PermisoDisponible.objects.filter(codename=CODENAME).delete()


class Migration(migrations.Migration):
    dependencies = [("billing", "0011_permisos_excluidos_suscripcion")]

    operations = [migrations.RunPython(dar_de_alta, retirar)]
