"""
Cómo se comporta la caja de este negocio.

Es a la caja lo que `capacidades.py` es al resto: un catálogo cerrado de
perillas, cada una con un consumidor real. Y con la misma disciplina, porque el
riesgo es el mismo: una opción que nadie lee promete una configurabilidad que
no existe, y en cuanto alguien la cambia y no pasa nada deja de fiarse del
resto de la pantalla.

Las cuatro zonas del POS y quién decide cada una:

    selector       `busqueda` y `muestra_imagenes`
    línea          `pide_atributos_en_linea`, `permite_nota_por_linea`
    panel lateral  `panel_lateral` — lo aportan los módulos (ver pos/paneles.py)
    cobro          `medios_pago` los declara el negocio en su propia tabla

Lo que NO está aquí, y se añadirá con el módulo que lo lea: `al_cobrar`
(imprimir comanda, recibo) necesita impresión, que todavía no existe. Ponerlo
ahora sería una casilla que no hace nada.
"""

#: Cómo encuentra el cajero lo que va a vender. Es la diferencia más visible
#: entre una boutique y una ferretería, y se resuelve con un valor, no con dos
#: pantallas.
BUSQUEDAS = {
    "rejilla": "Rejilla de productos con foto",
    "categorias": "Rejilla agrupada por categoría",
    "codigo_barras": "Campo de código de barras",
    "lista": "Lista compacta con buscador",
}

OPCIONES = {
    "busqueda": {
        "nombre": "Cómo se buscan los productos",
        "defecto": "rejilla",
        "opciones": BUSQUEDAS,
        "consumidor": "panel/modulos/pos: el selector",
    },
    "muestra_imagenes": {
        "nombre": "Mostrar fotos en el selector",
        "defecto": True,
        "consumidor": "panel/modulos/pos: el selector",
    },
    "pide_atributos_en_linea": {
        "nombre": "Preguntar talla, color o empaque al añadir",
        "defecto": False,
        "consumidor": "panel/modulos/pos: el renglón",
    },
    "permite_nota_por_linea": {
        "nombre": "Permitir una nota por renglón",
        "defecto": False,
        "consumidor": "panel/modulos/pos: el renglón",
    },
    "panel_lateral": {
        "nombre": "Panel al lado del carrito",
        "defecto": None,
        "consumidor": "pos/paneles.py — lo aportan los módulos",
    },
}

CLAVES = frozenset(OPCIONES)


def por_defecto() -> dict:
    return {codigo: datos["defecto"] for codigo, datos in OPCIONES.items()}


def normalizar(valores) -> dict:
    """
    Deja el perfil completo, sin nada de más y sin valores imposibles.

    Descarta lo desconocido en vez de rechazarlo —mismo criterio que
    `capacidades.normalizar` y que `tema.resolver`—, y además cae al valor por
    defecto cuando una opción trae algo que no está en su lista: una `busqueda`
    con un valor que el frontend no sabe pintar dejaría el selector en blanco,
    y una caja sin selector no vende.
    """
    limpio = por_defecto()
    for codigo, valor in (valores or {}).items():
        if codigo not in CLAVES:
            continue
        datos = OPCIONES[codigo]
        if "opciones" in datos:
            limpio[codigo] = valor if valor in datos["opciones"] else datos["defecto"]
        elif isinstance(datos["defecto"], bool):
            limpio[codigo] = bool(valor)
        else:
            limpio[codigo] = valor or None
    return limpio


def catalogo() -> list:
    """Para que el panel pinte los controles con su nombre y sus opciones."""
    return [
        {
            "codigo": codigo,
            "nombre": datos["nombre"],
            "defecto": datos["defecto"],
            "opciones": datos.get("opciones"),
        }
        for codigo, datos in OPCIONES.items()
    ]
