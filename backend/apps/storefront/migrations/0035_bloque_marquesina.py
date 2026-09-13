"""
El bloque «marquesina»: la cinta de texto en movimiento continuo.

Sirve de transición entre el Hero y lo que venga después sin gastar una
sección completa. Mismo patrón que `0027_bloque_video`: una fila en `Bloque`,
cero cambios al lienzo. El componente (`bloques/Marquesina.tsx`) es de
servidor —la animación es CSS puro— así que no añade JavaScript a la página.
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


MARQUESINA = {
    "nombre": "Marquesina",
    "descripcion": "Una cinta de frases cortas en movimiento continuo, de transición entre secciones.",
    "categoria": "CONTENIDO",
    "icono": "gallery-horizontal",
    "esquema_props": objeto(
        items={
            "tipo": "array",
            "titulo": "Frases",
            "items": objeto(
                texto=texto("Texto"),
                icono=texto("Icono", ayuda="Un nombre del catálogo compartido de íconos, ej. «hoja»."),
            ),
        },
        velocidad=numero(
            "Segundos por vuelta", 26, minimo=8, maximo=60,
            ayuda="Más alto, más lenta.",
        ),
    ),
    "variantes": [
        {"codigo": "oscura", "nombre": "Oscura (verde de marca)"},
        {"codigo": "clara", "nombre": "Clara"},
    ],
    "tokens_admitidos": [],
    "a_sangre": True,
    "requiere_datos": False,
    "orden": 15,
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.update_or_create(codigo="marquesina", defaults=MARQUESINA)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="marquesina").update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0034_copy_ayuda_y_seo_tienda")]

    operations = [migrations.RunPython(aplicar, revertir)]
