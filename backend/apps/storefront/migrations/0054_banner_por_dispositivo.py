"""
Los banners a pantalla completa ganan foto y encuadre para tablet, y el hero
gana los ajustes de diseño y legibilidad que el editor del panel agrupa.

# Qué añade

`hero-campana` y `campana-destacada`:

    imagen_tablet      foto alternativa entre 781 y 1024 px de ancho
    enfoque_tablet     su encuadre

Vacías —como quedan en todas las páginas existentes— la tienda usa la foto y el
encuadre de escritorio, que es exactamente lo que hacía hasta ahora.

`hero-campana`, además:

    altura             pantalla completa / alta / media
    alineacion         izquierda / centro / derecha
    posicion           arriba / centro / abajo
    oscurecer          capa oscura extra, 0–80 %
    degradado          editorial (el de siempre) / inferior / lateral / ninguno
    tono_texto         claro (el de siempre) / oscuro, para fotos claras
    cta_estilo         color del botón principal
    cta2_estilo        color del botón secundario
    cta_visible        mostrar u ocultar cada botón sin perder su texto
    cta2_visible

Cada valor por defecto reproduce el aspecto actual, así que ninguna tienda
cambia hasta que alguien toque el ajuste.

`opciones_etiquetas` acompaña a los `enum`: el valor guardado sigue siendo el
código («izquierda»), y el editor enseña el nombre («Izquierda»).

# Qué NO hace

No toca ninguna composición. Solo añade claves a dos esquemas y retitula las
fotos («Foto (URL)» → «Foto de escritorio»), así que es reversible quitándolas.
"""
import copy

from django.db import migrations

IMAGEN_TABLET = {
    "tipo": "string",
    "titulo": "Foto para tablet (opcional)",
    "formato": "imagen",
    "ayuda": "Vacía: se usa la de escritorio.",
}
ENFOQUE_TABLET = {"tipo": "string", "titulo": "Encuadre en tablet"}


def opcion(titulo, opciones, defecto, ayuda=""):
    campo = {
        "tipo": "enum",
        "titulo": titulo,
        "opciones": [codigo for codigo, _ in opciones],
        "opciones_etiquetas": dict(opciones),
        "default": defecto,
    }
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


ESTILOS_BOTON = [("ambar", "Acento"), ("oscuro", "Oscuro"), ("fantasma", "Contorno")]

HERO_NUEVOS = {
    "altura": opcion(
        "Altura del banner",
        [("completa", "Completa"), ("alta", "Alta"), ("media", "Media")],
        "completa",
        "Completa ocupa la pantalla; media deja ver la siguiente sección.",
    ),
    "alineacion": opcion(
        "Alineación del texto",
        [("izquierda", "Izquierda"), ("centro", "Centro"), ("derecha", "Derecha")],
        "izquierda",
    ),
    "posicion": opcion(
        "Posición del contenido",
        [("arriba", "Arriba"), ("centro", "Centro"), ("abajo", "Abajo")],
        "arriba",
    ),
    "oscurecer": {
        "tipo": "number",
        "titulo": "Oscurecer la foto",
        "default": 0,
        "minimo": 0,
        "maximo": 80,
        "ayuda": "Súbelo si el texto se pierde sobre la foto.",
    },
    "degradado": opcion(
        "Degradado",
        [("editorial", "Editorial"), ("inferior", "Inferior"), ("lateral", "Lateral"), ("ninguno", "Ninguno")],
        "editorial",
        "Sombra suave detrás del texto. «Editorial» es la de siempre.",
    ),
    "tono_texto": opcion(
        "Color del texto",
        [("claro", "Claro"), ("oscuro", "Oscuro")],
        "claro",
        "Oscuro solo para fotos muy claras.",
    ),
    "cta_visible": {"tipo": "boolean", "titulo": "Mostrar el botón principal", "default": True},
    "cta_estilo": opcion("Color del botón principal", ESTILOS_BOTON, "ambar"),
    "cta2_visible": {"tipo": "boolean", "titulo": "Mostrar el botón secundario", "default": True},
    "cta2_estilo": opcion("Color del botón secundario", ESTILOS_BOTON, "fantasma"),
}

TITULOS = {
    "imagen": "Foto de escritorio",
    "imagen_movil": "Foto para móvil (opcional)",
    "enfoque": "Encuadre en escritorio",
    "enfoque_movil": "Encuadre en móvil",
}


def _con_tablet(propiedades):
    """Inserta las claves de tablet justo detrás de las de móvil (el orden es el del formulario)."""
    salida = {}
    for clave, campo in propiedades.items():
        if clave in TITULOS:
            campo = {**campo, "titulo": TITULOS[clave]}
        salida[clave] = campo
        if clave == "imagen_movil" and "imagen_tablet" not in propiedades:
            salida["imagen_tablet"] = IMAGEN_TABLET
        if clave == "enfoque_movil" and "enfoque_tablet" not in propiedades:
            salida["enfoque_tablet"] = ENFOQUE_TABLET
    return salida


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.filter(codigo__in=("hero-campana", "campana-destacada")):
        esquema = copy.deepcopy(bloque.esquema_props or {})
        propiedades = _con_tablet(esquema.get("properties") or {})
        if bloque.codigo == "hero-campana":
            for clave, campo in HERO_NUEVOS.items():
                propiedades.setdefault(clave, campo)
        else:
            propiedades["alineacion"] = opcion(
                "Alineación del texto",
                [("izquierda", "Izquierda"), ("centro", "Centro")],
                "izquierda",
            )
        esquema["properties"] = propiedades
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    quitar = {"imagen_tablet", "enfoque_tablet", *HERO_NUEVOS}
    for bloque in Bloque.objects.filter(codigo__in=("hero-campana", "campana-destacada")):
        esquema = copy.deepcopy(bloque.esquema_props or {})
        propiedades = esquema.get("properties") or {}
        for clave in quitar:
            if bloque.codigo == "campana-destacada" and clave == "alineacion":
                continue
            propiedades.pop(clave, None)
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


class Migration(migrations.Migration):

    dependencies = [("storefront", "0053_menu_sin_para_negocios")]

    operations = [migrations.RunPython(aplicar, revertir)]
