"""
Cambia «Cinta de marca» por «Ornamento» en el bloque Separador.

`0038` había registrado una variante que repetía una imagen subida por el
negocio (`imagen_url`). Se descarta antes de usarse en ninguna página: una
línea con un rombo dibujada en SVG, coloreada con el tema de cada tienda
(`background-color` + `mask-image`, ver `bloques/Separador.tsx`), no necesita
que nadie suba nada y sirve para cualquier negocio del motor tal cual.
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
    imagen_url=texto(
        "Imagen de marca",
        ayuda=(
            "Solo la usa la variante 'Cinta de marca': el emblema del negocio, "
            "repetido a lo ancho. Sin ella, esa variante se ve como 'Linea'."
        ),
    ),
)

ESQUEMA_PROPS_AHORA = objeto(
    espacio=numero(
        "Cuanto separa", 2, minimo=0, maximo=10,
        ayuda="Se multiplica por la densidad de la tienda.",
    ),
)

VARIANTES_ANTES = [
    {"codigo": "linea", "nombre": "Linea"},
    {"codigo": "aire", "nombre": "Solo espacio"},
    {"codigo": "punto", "nombre": "Puntos"},
    {"codigo": "marca", "nombre": "Cinta de marca"},
]

VARIANTES_AHORA = [
    {"codigo": "linea", "nombre": "Linea"},
    {"codigo": "aire", "nombre": "Solo espacio"},
    {"codigo": "punto", "nombre": "Puntos"},
    {"codigo": "ornamento", "nombre": "Ornamento"},
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

    dependencies = [("storefront", "0038_separador_cinta_de_marca")]

    operations = [migrations.RunPython(aplicar, revertir)]
