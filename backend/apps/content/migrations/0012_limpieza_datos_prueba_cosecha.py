"""
Limpieza de datos de prueba en el contenido de La Gran Cosecha.

Al revisar el contenido real de este tenant para el rediseno del Home
(`storefront.0028_home_landing_comercial`) aparecieron dos restos de pruebas,
aprobados para limpiar por el propio negocio:

* Un `TrustBadge` con etiqueta "ssss" y valor "5" — no es una insignia real,
  es texto de prueba que quedo cargado.
* Un `BeneficioComercial` "Frescura Garantizada" duplicado: la misma tarjeta
  existe dos veces, una con icono `clock` y otra con icono `wallet`. Se
  conserva la de `wallet` y se borra la de `clock` porque ese icono ya lo usa
  "Ahorra tiempo" — conservar ambas dejaria dos beneficios con el mismo
  dibujo en la misma seccion.

Solo toca al tenant "la-gran-cosecha" y solo esas filas puntuales, por
titulo/etiqueta exactos: ningun otro negocio ni ninguna otra fila de contenido
se lee ni se escribe.

# Por que esto no se revierte

Es basura, no una decision de negocio: no hay un estado anterior con sentido
al que volver. `revertir()` es deliberadamente un no-op documentado, el mismo
criterio que usan las migraciones de composicion de `storefront` para no
deshacer contenido en vez de estructura.
"""
from django.db import migrations


TENANT_SLUG = "la-gran-cosecha"


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    TrustBadge = apps.get_model("content", "TrustBadge")
    BeneficioComercial = apps.get_model("content", "BeneficioComercial")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    TrustBadge.objects.filter(tenant=tenant, etiqueta="ssss").delete()
    BeneficioComercial.objects.filter(
        tenant=tenant, titulo="Frescura Garantizada", icono="clock"
    ).delete()


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [("content", "0011_tokens_de_tema_esquema")]

    operations = [migrations.RunPython(aplicar, revertir)]
