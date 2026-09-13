"""
Preserva el chip "TECHRG" que la factura de La Gran Cosecha ya mostraba.

`0022` agrega `factura_chip_secundario` como un campo nuevo, vacío por
defecto (una tienda nueva no debería salir con un texto que no pidió). Pero
la plantilla de factura (`_factura_body.html`) traía ese texto ESCRITO A
MANO en el HTML —`<span class="tech-brand">TECHRG</span>`—, visible para
cualquier tenant sin que nadie lo hubiera configurado. Al mover ese chip al
campo nuevo (ver el cambio en `apps/orders/pdf.py`/`_factura_body.html`),
sin este dato el chip desaparecería de la factura de este negocio en el
mismo despliegue: esta migración lo traslada para que no cambie nada visible
hasta que el negocio decida editarlo o quitarlo desde el panel.

El resto de los campos nuevos de `0022` no necesitan backfill: sus valores
por defecto (tinte de logo activo, marca de agua encendida al 5%, sin nota de
pie propia) ya reproducen exactamente lo que la plantilla hacía fija en
código antes de este cambio.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
CHIP = "TECHRG"


def aplicar(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(tenant=tenant, factura_chip_secundario="").update(
        factura_chip_secundario=CHIP
    )


def revertir(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(tenant=tenant, factura_chip_secundario=CHIP).update(
        factura_chip_secundario=""
    )


class Migration(migrations.Migration):

    dependencies = [("content", "0022_configuracion_factura")]

    operations = [migrations.RunPython(aplicar, revertir)]
