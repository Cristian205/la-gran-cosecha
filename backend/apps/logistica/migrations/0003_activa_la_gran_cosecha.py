"""
Enciende el plano de carga para La Gran Cosecha, que es quien lo pidió.

Un módulo funciona si el plan lo cubre Y el negocio lo tiene encendido
(`business.aplicar.modulos_activos`). Aquí se hacen las dos cosas, pero con
cuidado con la primera: el plan es COMPARTIDO entre negocios, y añadirle
permisos se los vende a todos los que lo usan. Por eso solo se toca si La Gran
Cosecha es el único negocio con ese plan; si no, se deja como está y el plan se
amplía a mano desde el panel de la plataforma (decisión comercial, no técnica).

Si el negocio no existe (otra instalación), no hace nada.
"""
from django.db import migrations

SLUG_NEGOCIO = "la-gran-cosecha"
SLUG_MODULO = "plano-carga"
PERMISOS = ["logistica.view_planocarga", "logistica.add_planocarga", "logistica.change_furgon"]


def activar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Subscription = apps.get_model("billing", "Subscription")
    Producto = apps.get_model("billing", "Producto")
    TenantModulo = apps.get_model("business", "TenantModulo")

    negocio = Tenant.objects.filter(slug=SLUG_NEGOCIO).first()
    modulo = Producto.objects.filter(slug=SLUG_MODULO).first()
    if negocio is None or modulo is None:
        return

    suscripcion = Subscription.objects.filter(tenant=negocio).select_related("plan").first()
    plan = suscripcion.plan if suscripcion else None
    if plan is not None:
        compartido = Subscription.objects.filter(plan=plan).exclude(tenant=negocio).exists()
        if not compartido:
            faltan = [p for p in PERMISOS if p not in (plan.permisos or [])]
            if faltan:
                plan.permisos = [*(plan.permisos or []), *faltan]
                plan.save(update_fields=["permisos"])

    activacion, _ = TenantModulo.objects.get_or_create(tenant=negocio, modulo=modulo, defaults={"activo": True})
    if not activacion.activo:
        activacion.activo = True
        activacion.save(update_fields=["activo"])


class Migration(migrations.Migration):
    dependencies = [
        ("logistica", "0002_row_level_security"),
        ("billing", "0014_producto_plano_carga"),
        ("business", "__latest__"),
        ("tenancy", "__latest__"),
    ]

    # Al revertir no se apaga nada: quitarle un módulo a un cliente no debe
    # pasar por deshacer una migración.
    operations = [migrations.RunPython(activar, migrations.RunPython.noop)]
