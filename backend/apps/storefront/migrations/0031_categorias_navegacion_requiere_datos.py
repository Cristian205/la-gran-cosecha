"""
`categorias-navegacion` pasa a `requiere_datos=True`.

Es solo documentación honesta del catálogo: desde ahora el frontend SÍ
resuelve sus categorías en el servidor (`RESUELVE_EN_SERVIDOR` en
`lib/pagina.ts`, para corregir el "190 productos · 0 categorías" que se veía
en la primera pintura). El campo no condiciona nada en el propio motor —el
mapa que de verdad decide qué se resuelve vive en el frontend, no aquí— pero
dejarlo en `False` seguiría diciéndole a quien mire el panel que este bloque
nunca toca el backend, y eso ya no es cierto.
"""
from django.db import migrations


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="categorias-navegacion").update(requiere_datos=True)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="categorias-navegacion").update(requiere_datos=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0030_home_anuncios_reemplaza_productos")]

    operations = [migrations.RunPython(aplicar, revertir)]
