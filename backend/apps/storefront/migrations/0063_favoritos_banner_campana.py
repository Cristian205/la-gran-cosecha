"""
`favoritos-negocios`: el protagonista pasa de ficha de compra a banner.

El banner no vende en el sitio: lleva a la tarjeta del producto en el
catálogo, donde se elige variedad, unidad y cantidad. Lo que el negocio
configura es la campaña con la que lo presenta. Se AÑADEN al esquema del
bloque (no se reescribe lo que ya tenía):

- `campana`: Automática / Más vendido / De temporada / Recomendado / Nuevo.
  «Automática» es lo de siempre: «El más pedido» si el producto sale del
  ranking real de ventas, la etiqueta sin historial si no.
- `texto_comercial`: la frase bajo el nombre. Vacía: una por campaña.
- `mostrar_precio`: el precio orientativo («Desde $3.000 / Libra aprox.»).
- `texto_boton`: «Comprar ahora» por defecto.

El producto sigue siendo el de `productos` (elegido a mano, el primero con
foto) o el ranking de ventas: no hay una estructura comercial aparte.

Solo toca el catálogo de bloques; ninguna composición cambia. Reversible.
"""
from django.db import migrations

CAMPANAS = [
    ("auto", "Automática (según ventas)"),
    ("mas-vendido", "Más vendido"),
    ("temporada", "De temporada"),
    ("recomendado", "Recomendado"),
    ("novedad", "Nuevo"),
]

PROPS_NUEVAS = {
    "campana": {
        "tipo": "enum",
        "titulo": "Campaña del banner",
        "ayuda": "La etiqueta sobre el producto destacado. «Automática»: «El más pedido» si sale del ranking real de ventas.",
        "opciones": [c for c, _ in CAMPANAS],
        "opciones_etiquetas": dict(CAMPANAS),
        "default": "auto",
    },
    "texto_comercial": {
        "tipo": "string",
        "titulo": "Texto comercial",
        "ayuda": "Una frase corta bajo el nombre del producto. Vacío: un texto según la campaña.",
    },
    "mostrar_precio": {
        "tipo": "boolean",
        "titulo": "Mostrar precio orientativo",
        "ayuda": "«Desde $3.000 / Libra aprox.»: el precio más bajo entre sus presentaciones.",
        "default": True,
    },
    "texto_boton": {
        "tipo": "string",
        "titulo": "Texto del botón",
        "default": "Comprar ahora",
    },
}

# La lista «También puedes pedir…» se retiró: el bloque es solo el banner.
# Sus campos salen del formulario (una composición que aún los guarde no
# falla: el lienzo ignora props que el componente ya no lee).
PROPS_RETIRADAS = {
    "titulo_secundarios": {"tipo": "string", "titulo": "Título de la lista", "default": "También puedes pedir…"},
    "secundarios": {"tipo": "number", "titulo": "Productos en la lista", "default": 4},
}

TITULOS = {
    "productos": {
        "titulo": "Producto del banner (opcional)",
        "ayuda": "Se usa el primero que tenga foto. Vacío: el más vendido según el ranking real de ventas.",
    },
    "kicker_principal": {"titulo": "Etiqueta automática (con ventas)"},
    "kicker_sin_historial": {"titulo": "Etiqueta automática (sin historial de ventas)"},
}

DESCRIPCION = (
    "Escaparate del catálogo: un banner con un producto destacado (foto, campaña, "
    "texto y «Comprar ahora», que lleva a su tarjeta en el catálogo). Se oculta "
    "mientras hay un filtro o una búsqueda activa."
)


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="favoritos-negocios").first()
    if bloque is None:
        return
    esquema = dict(bloque.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    for clave, campo in PROPS_NUEVAS.items():
        propiedades.setdefault(clave, campo)
    for clave in PROPS_RETIRADAS:
        propiedades.pop(clave, None)
    for clave, cambios in TITULOS.items():
        if clave in propiedades:
            propiedades[clave] = {**propiedades[clave], **cambios}
    esquema["properties"] = propiedades
    bloque.esquema_props = esquema
    bloque.descripcion = DESCRIPCION
    bloque.save(update_fields=["esquema_props", "descripcion"])


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="favoritos-negocios").first()
    if bloque is None:
        return
    esquema = dict(bloque.esquema_props or {})
    propiedades = {k: v for k, v in (esquema.get("properties") or {}).items() if k not in PROPS_NUEVAS}
    for clave, campo in PROPS_RETIRADAS.items():
        propiedades.setdefault(clave, campo)
    esquema["properties"] = propiedades
    bloque.esquema_props = esquema
    bloque.save(update_fields=["esquema_props"])


class Migration(migrations.Migration):

    dependencies = [("storefront", "0062_pie_sin_llamada_final")]

    operations = [migrations.RunPython(aplicar, revertir)]
