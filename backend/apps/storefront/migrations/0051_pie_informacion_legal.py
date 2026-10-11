"""
El pie gana la columna «Información legal» y la línea de identificación del
comercio (razón social, NIT, dirección y contacto), que enlazan al centro
legal de la tienda.

Solo AGREGA dos propiedades al esquema del bloque `pie` —`mostrar_legal` y
`legal_titulo`— sobre el esquema que haya, sin reescribirlo: así no se pisa
ninguna propiedad que otra migración haya añadido entre medias. Ninguna tienda
tiene que hacer nada: la columna sale encendida por defecto.
"""
from django.db import migrations

NUEVAS = {
    "mostrar_legal": {
        "tipo": "boolean",
        "titulo": "Mostrar información legal",
        "default": True,
        "ayuda": "Columna de enlaces a las políticas y línea con razón social, NIT y contacto.",
    },
    "legal_titulo": {
        "tipo": "string",
        "titulo": "Columna legal: titulo",
        "default": "Información legal",
    },
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.filter(codigo="pie"):
        esquema = dict(bloque.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        propiedades.update({k: v for k, v in NUEVAS.items() if k not in propiedades})
        esquema["properties"] = propiedades
        esquema.setdefault("tipo", "object")
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.filter(codigo="pie"):
        esquema = dict(bloque.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        for clave in NUEVAS:
            propiedades.pop(clave, None)
        esquema["properties"] = propiedades
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


class Migration(migrations.Migration):
    dependencies = [
        ("storefront", "0050_campos_con_formato_y_destacados_manuales"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
