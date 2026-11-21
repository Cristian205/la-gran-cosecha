"""
Hace asignable «Registrar pedidos desde el panel» (`orders.add_pedido`).

Sin esto el permiso existe en el código pero no en el catálogo que la
plataforma ofrece, y `permisos_disponibles()` acota TODO a lo que está activo
ahí: el botón de registrar un pedido no le aparecía a nadie, ni al dueño de la
cuenta, porque el filtro del plan va antes que el rol.

Se suma a los planes que ya conceden editar pedidos: es el mismo módulo y no
abre nada que el plan no venda ya. Quien tenga ese plan y el rol de dueño lo
tiene de inmediato; a los demás roles se les concede desde Usuarios.
"""
from django.db import migrations

CODENAME = "orders.add_pedido"
HERMANO = "orders.change_pedido"


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
            "etiqueta": "Registrar pedidos desde el panel",
            "descripcion": "Apuntar el pedido que llegó por teléfono, WhatsApp o mostrador.",
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
    dependencies = [("billing", "0014_producto_plano_carga")]

    operations = [migrations.RunPython(dar_de_alta, retirar)]
