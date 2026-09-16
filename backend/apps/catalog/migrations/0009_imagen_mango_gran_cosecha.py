"""
Reemplaza la foto de "Mango" en La Gran Cosecha por la que subieron a la
biblioteca de medios del panel.

`Producto.imagen` guarda solo la ruta relativa dentro del bucket (el storage
de R2 arma la URL publica a partir de `R2_PUBLIC_URL` + `R2_LOCATION` + esa
ruta) — no la URL completa. La ruta de abajo es la URL que dieron
(`https://pub-.../media/tenants/.../biblioteca/2026/09/ee52e1210c3a4878ab83a79a_eZST5Zv.jpg`)
sin el dominio publico ni el prefijo `media/` (ese prefijo es `R2_LOCATION`,
no parte del nombre del archivo).

Este cambio afecta a "Mango" en TODAS partes donde se muestra su imagen
—catalogo, ficha de producto, y el bloque "producto-destacado" cuando le
toque salir como mas vendido— porque todas leen el mismo campo `imagen_url`.
No hay una imagen distinta "solo para mas vendidos": es un unico campo por
producto.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
NOMBRE_PRODUCTO = "Mango"
NUEVA_RUTA = "tenants/f7ab4600-83cb-42ab-b17a-d694532d8b71/biblioteca/2026/09/ee52e1210c3a4878ab83a79a_eZST5Zv.jpg"


def aplicar(apps, schema_editor):
    Producto = apps.get_model("catalog", "Producto")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    Producto.objects.filter(tenant=tenant, nombre_producto=NOMBRE_PRODUCTO).update(
        imagen=NUEVA_RUTA
    )


def revertir(apps, schema_editor):
    # No se conoce la ruta anterior con certeza (no quedó registrada en
    # ningún lado antes de este cambio), así que revertir no restaura la foto
    # vieja — solo evita que un `migrate` hacia atrás falle por no tener
    # `reverse_code`. Cambiar la foto de vuelta, si hiciera falta, es una
    # operación manual desde el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0008_categoria_cta_texto_categoria_subtitulo"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
