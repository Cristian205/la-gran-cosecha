"""
El Mango de La Gran Cosecha usa la foto del mango común.

La foto del producto es la que sale en «Los más vendidos» (y en el catálogo).
La anterior era una composición de mangos sobre una mesa, que no se parece al
producto que se vende; se cambia por la de su presentación «Común»: la caja de
mangos reales. Si hay varias «Común» con foto, se toma la más pesada (la de
mayor resolución).

# Por qué se COPIA y no se reutiliza el archivo

Quitar la foto de una presentación borra el archivo del almacenamiento
(`catalog.views`). Si el producto apuntara al mismo archivo, quitarla en la
presentación lo dejaría sin foto. Así que se copia a la carpeta de productos.

La foto anterior no se borra: vive en la biblioteca de medios del negocio y
puede volver a elegirse desde el panel. Por eso `revertir` no hace nada.

Si no existe el negocio, el producto o la foto (otra base, otro entorno), no
hace nada. Si el almacenamiento no responde, avisa y sigue: la migración no
puede dejar a medias un despliegue por una foto.
"""
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
PRODUCTO_SLUG = "mango"
PRESENTACION = "Común"
NOMBRE_ARCHIVO = "mango-comun"


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Producto = apps.get_model("catalog", "Producto")
    PresentacionProducto = apps.get_model("catalog", "PresentacionProducto")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    producto = Producto.objects.filter(tenant=tenant, slug=PRODUCTO_SLUG).first()
    if producto is None:
        return

    candidatas = [
        p
        for p in PresentacionProducto.objects.filter(
            tenant=tenant, producto=producto, nombre_presentacion=PRESENTACION
        ).exclude(imagen="").exclude(imagen__isnull=True)
    ]
    if not candidatas:
        return

    try:
        origen = max(candidatas, key=lambda p: default_storage.size(p.imagen.name))
        with default_storage.open(origen.imagen.name, "rb") as archivo:
            contenido = archivo.read()
    except Exception as error:  # noqa: BLE001 — almacenamiento externo (R2)
        print(f"\n  Aviso: no se pudo copiar la foto del mango común ({error}). Se deja la actual.")
        return

    extension = origen.imagen.name.rsplit(".", 1)[-1].lower()
    producto.imagen.save(f"{NOMBRE_ARCHIVO}.{extension}", ContentFile(contenido), save=False)
    producto.save(update_fields=["imagen"])


class Migration(migrations.Migration):

    dependencies = [("catalog", "0013_indice_y_restricciones_presentacion")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
