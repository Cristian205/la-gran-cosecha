"""
El contenedor de La Gran Cosecha pasa de 1200px a 1600px.

A petición directa del negocio: en monitores anchos el contenido se sentía
apretado con demasiado margen a los lados. `--contenedor-ancho` ya es un
token normal del catálogo (ver `TokenTema`), así que esto es una edición de
configuración del tenant, no un cambio de `global.css` — la regla
`.contenedor { max-width: var(--contenedor-ancho, 1440px); }` no se toca; solo
cambia el valor que este negocio le da.

No se lleva a "sin límite" (borde a borde): con `--columnas-catalogo` fijo en
4, una rejilla de productos sin ningún tope se estira demasiado en monitores
ultra anchos (2560px+) y separa las tarjetas más de lo legible.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
CLAVE = "contenedor-ancho"
VALOR_PREVIO = "1200"
VALOR_NUEVO = "1600"


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    StoreSettings = apps.get_model("content", "StoreSettings")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    config = StoreSettings.objects.filter(tenant=tenant).first()
    if config is None:
        return

    config.tokens = {**(config.tokens or {}), CLAVE: VALOR_NUEVO}
    config.save(update_fields=["tokens"])


def revertir(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    StoreSettings = apps.get_model("content", "StoreSettings")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    config = StoreSettings.objects.filter(tenant=tenant).first()
    if config is None:
        return

    config.tokens = {**(config.tokens or {}), CLAVE: VALOR_PREVIO}
    config.save(update_fields=["tokens"])


class Migration(migrations.Migration):

    dependencies = [("content", "0016_restaura_marca_verde_cosecha")]

    operations = [migrations.RunPython(aplicar, revertir)]
