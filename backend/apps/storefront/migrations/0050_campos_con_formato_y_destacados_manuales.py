"""
Los formularios del constructor saben qué es cada campo, y los destacados se
pueden elegir a mano.

# `formato` en los esquemas

Hasta ahora una foto era un campo de texto donde había que pegar una URL, y
un destino un texto libre. El esquema de cada bloque declara ahora el
`formato` de esos campos —`imagen`, `video`, `enlace`— y el panel pinta el
control que corresponde: subir/elegir de la biblioteca con vista previa,
sugerencias de rutas de la tienda. Se deriva del nombre de la propiedad
(`imagen`, `imagen_movil`, `poster_url`, `video_url`, `*_href`), que es la
convención que todos los bloques ya siguen. Un campo que no encaje queda
como estaba: texto.

# Productos destacados a mano

`producto-spotlight` (los más vendidos) y `favoritos-negocios` ganan
`productos`: una lista de productos elegidos por el negocio, en su orden.
Vacía —como queda en todas las páginas existentes— el bloque sigue usando el
ranking real de ventas. Lo promocional (qué se destaca en el Home) queda así
separado del catálogo (qué existe y a qué precio).

# Reversible

Solo añade claves a los esquemas; quitarlas no rompe ninguna composición.
"""
import copy

from django.db import migrations

IMAGEN = {"imagen", "imagen_movil", "poster_url", "logo", "logo_url", "foto", "fondo"}
VIDEO = {"video_url", "video_movil_url"}

PRODUCTOS = {
    "tipo": "array",
    "titulo": "Productos elegidos a mano (opcional)",
    "formato": "productos",
    "ayuda": "Si eliges productos, se muestran estos y en este orden. Vacío: se usa el ranking real de ventas.",
    "items": {"tipo": "number"},
}


def _formato(clave):
    if clave in IMAGEN:
        return "imagen"
    if clave in VIDEO:
        return "video"
    if clave == "href" or clave.endswith("_href"):
        return "enlace"
    return None


def anotar(esquema):
    """Añade `formato` a cada propiedad reconocible, también dentro de listas."""
    esquema = copy.deepcopy(esquema or {})
    for clave, campo in (esquema.get("properties") or {}).items():
        if not isinstance(campo, dict):
            continue
        if campo.get("tipo") == "string" and "formato" not in campo:
            formato = _formato(clave)
            if formato:
                campo["formato"] = formato
        items = campo.get("items")
        if campo.get("tipo") == "array" and isinstance(items, dict) and items.get("tipo") == "object":
            campo["items"] = anotar(items)
    return esquema


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.all():
        esquema = anotar(bloque.esquema_props)
        if bloque.codigo in ("producto-spotlight", "favoritos-negocios"):
            esquema.setdefault("properties", {})["productos"] = PRODUCTOS
        if esquema != bloque.esquema_props:
            bloque.esquema_props = esquema
            bloque.save(update_fields=["esquema_props"])


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0049_mas_vendidos_carrusel"),
    ]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
