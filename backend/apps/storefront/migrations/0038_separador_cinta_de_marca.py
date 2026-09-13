"""
La variante «cinta de marca» del separador: el emblema del negocio repetido,
en vez de una línea gris.

La imagen es una propiedad del bloque (`imagen_url`), no algo fijo en el
componente: este motor es multi-negocio, y una cinta con el logo de un solo
negocio grabado en el código serviría solo a ese negocio. Sin `imagen_url`
puesta, el componente hace caer la variante a `linea` — una cinta de marca
vacía es un hueco, no un separador.
"""
from django.db import migrations


def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def numero(titulo, defecto=None, minimo=1, maximo=None, ayuda=""):
    campo = {"tipo": "number", "titulo": titulo, "minimo": minimo}
    if defecto is not None:
        campo["default"] = defecto
    if maximo is not None:
        campo["maximo"] = maximo
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


ESQUEMA_PROPS_ANTES = objeto(
    espacio=numero(
        "Cuanto separa", 2, minimo=0, maximo=10,
        ayuda="Se multiplica por la densidad de la tienda.",
    ),
)

ESQUEMA_PROPS_AHORA = objeto(
    espacio=numero(
        "Cuanto separa", 2, minimo=0, maximo=10,
        ayuda="Se multiplica por la densidad de la tienda.",
    ),
    imagen_url=texto(
        "Imagen de marca",
        ayuda=(
            "Solo la usa la variante 'Cinta de marca': el emblema del negocio, "
            "repetido a lo ancho. Sin ella, esa variante se ve como 'Linea'."
        ),
    ),
)

VARIANTES_ANTES = [
    {"codigo": "linea", "nombre": "Linea"},
    {"codigo": "aire", "nombre": "Solo espacio"},
    {"codigo": "punto", "nombre": "Puntos"},
]

VARIANTES_AHORA = VARIANTES_ANTES + [
    {"codigo": "marca", "nombre": "Cinta de marca"},
]


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="separador").update(
        esquema_props=ESQUEMA_PROPS_AHORA, variantes=VARIANTES_AHORA
    )


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="separador").update(
        esquema_props=ESQUEMA_PROPS_ANTES, variantes=VARIANTES_ANTES
    )


class Migration(migrations.Migration):

    dependencies = [("storefront", "0037_orden_del_menu_tienda")]

    operations = [migrations.RunPython(aplicar, revertir)]
