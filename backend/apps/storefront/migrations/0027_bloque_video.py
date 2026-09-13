"""
El bloque de video publicitario.

Es el unico hueco de verdad que quedaba frente al encargo de "una landing
comercial de abastecimiento": ya habia hero (`portada`), propuesta de valor
(`por-que-elegirnos`), segmentos B2B (`publicos-objetivo`), storytelling
(`como-funciona`), banner tipo CMS (`banner-promocional`), testimonios,
estadisticas y cierre (`cta-banda`). Nada del motor sabia pintar un video de
fondo con texto encima.

Sigue el mismo patron que `0023_biblioteca_de_bloques`: una fila en `Bloque`
con su `esquema_props`, cero cambios al lienzo ni al validador. El componente
(`bloques/Video.tsx`) ya sabe pintarse sin `video_url` —un marcador de
posicion con el mismo texto— asi que el bloque se puede colocar desde el panel
antes de que el negocio tenga el archivo real.
"""
from django.db import migrations


# --------------------------------------------------------------------------
# Los mismos ayudantes que 0023 y 0009. Copiados y no importados: una
# migracion que importa de otra hace lo que aquella diga DENTRO DE UN ANO, no
# lo que decia el dia que se escribio.
# --------------------------------------------------------------------------
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def bandera(titulo, defecto=False, ayuda=""):
    campo = {"tipo": "boolean", "titulo": titulo, "default": defecto}
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


BASE = [
    "bloque-fondo",
    "color-texto",
    "seccion-espacio",
]

VIDEO = {
    "nombre": "Video",
    "descripcion": "Un video de fondo con texto encima. Para campanas y anuncios.",
    "categoria": "CONTENIDO",
    "icono": "play-circle",
    "esquema_props": objeto(
        kicker=texto("Antetitulo", ayuda="«Del abasto a tu negocio»."),
        kicker_icono=texto("Icono del antetitulo", "chispa"),
        titulo=texto("Titulo"),
        texto=texto("Texto"),
        video_url=texto(
            "Video (URL de un archivo, ej. .mp4)",
            ayuda="Vacio deja el marcador de posicion con el texto puesto.",
        ),
        poster_url=texto(
            "Imagen de respaldo (URL)",
            ayuda="Se ve mientras el video carga, y si no hay video_url.",
        ),
        video_alt=texto(
            "Texto alternativo",
            ayuda="Lo que lee quien no ve el video. Vacio cae al titulo.",
        ),
        cta_texto=texto("Texto del boton"),
        cta_href=texto("Enlace del boton", "/tienda"),
        autoplay=bandera(
            "Reproducir automaticamente",
            True,
            ayuda="Siempre en silencio. Se respeta si el visitante pidio menos movimiento.",
        ),
    ),
    "variantes": [
        {"codigo": "horizontal", "nombre": "Horizontal (16:9)"},
        {"codigo": "vertical", "nombre": "Vertical (9:16, campanas para movil)"},
    ],
    "tokens_admitidos": BASE,
    "a_sangre": True,
    "requiere_datos": False,
    "orden": 40,
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.update_or_create(codigo="video", defaults=VIDEO)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    # Se DESACTIVA en vez de borrarse: el mismo criterio que 0023 aplica a sus
    # seis bloques nuevos. Un bloque borrado que alguna pagina tenga puesto
    # dejaria a esa pagina sin poder guardarse.
    Bloque.objects.filter(codigo="video").update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0026_pagina_no_encontrada")]

    operations = [migrations.RunPython(aplicar, revertir)]
