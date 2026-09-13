"""
"Soacha" -> "Soacha, Cundinamarca" en la configuración de La Gran Cosecha.

Solo el dato de este negocio: `ciudad` es texto libre en `StoreSettings`, así
que agregar el departamento es corregir el valor, no un cambio de esquema.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
CIUDAD_ANTES = "Soacha"
CIUDAD_AHORA = "Soacha, Cundinamarca"


def aplicar(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(tenant=tenant, ciudad=CIUDAD_ANTES).update(ciudad=CIUDAD_AHORA)


def revertir(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(tenant=tenant, ciudad=CIUDAD_AHORA).update(ciudad=CIUDAD_ANTES)


class Migration(migrations.Migration):

    dependencies = [("content", "0019_beneficios_marmol_gran_cosecha")]

    operations = [migrations.RunPython(aplicar, revertir)]
