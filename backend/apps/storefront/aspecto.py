"""
La identidad que una plantilla propone, copiada al negocio que la adopta.

Va aparte de `tema.py` porque son dos cosas distintas y confundirlas costaría
caro. `tema.py` resuelve TOKENS —el catálogo de perillas que Crynex define— y
esto copia los CAMPOS DE MARCA de `StoreSettings`: el color primario, la
tipografía, el redondeo de los botones. Esos campos existen desde antes del
motor de temas y de ellos la tienda deriva su escala de color entera, así que
no se pueden expresar como tokens sin partir la escala por la mitad.

# Por qué esto no duplica el color de marca

La regla del sistema es «un dato, un sitio», y el color de marca vive en
`StoreSettings`. Lo que guarda la plantilla no es el color del negocio: es el
que PROPONE para quien la adopte. Se copia una vez, en la adopción, y a partir
de ahí manda el del negocio — exactamente como las páginas, y por la misma
razón que ellas: referenciarlo haría que retocar la plantilla en Crynex
cambiara el color de todas las tiendas que la usan, en producción y sin aviso.

# La lista es cerrada

Una clave que no esté aquí se descarta en silencio, igual que hace
`capacidades.normalizar()` con una bandera desconocida. La alternativa —copiar
lo que venga con `setattr`— convertiría un JSON editable desde el panel de
Crynex en escritura arbitraria sobre el modelo de configuración del negocio.
"""

#: Los campos de `StoreSettings` que una plantilla puede proponer. Cada uno lo
#: lee `tienda/src/lib/tema.ts` para construir las variables CSS; ninguno está
#: aquí «por si acaso».
CAMPOS_DE_MARCA = (
    "color_primario",
    "color_primario_texto",
    "color_secundario",
    "color_secundario_texto",
    "color_fondo",
    "color_superficie",
    "color_texto",
    "fuente",
    "radio_boton",
)


def limpiar_marca(valores) -> dict:
    """Solo las claves del catálogo, y sin vacíos."""
    return {
        campo: valor
        for campo, valor in (valores or {}).items()
        if campo in CAMPOS_DE_MARCA and valor not in (None, "")
    }


def aplicar_aspecto(tenant, plantilla) -> dict:
    """
    Deja en el negocio el aspecto que propone la plantilla.

    Dos capas y en este orden, el mismo que ya usa `tema.resolver()`: primero
    el `Tema` compartido, luego lo que la plantilla dice encima. Cada una pisa
    solo lo que declara, así que una plantilla que no menciona el color del pie
    deja el del tema en pie.

    Se aplica ENCIMA de lo que el negocio ya tenía y no en lugar de ello:
    adoptar una plantilla propone un aspecto, no borra los ajustes que no
    menciona. Es la misma decisión que `business.aplicar_tema`.
    """
    from apps.content.models import StoreSettings  # noqa: PLC0415 — evita el ciclo

    tokens = {}
    if plantilla.tema_id:
        tokens.update(plantilla.tema.valores or {})
    tokens.update(plantilla.tema_valores or {})
    marca = limpiar_marca(plantilla.marca)

    if not tokens and not marca:
        return {}

    config, _ = StoreSettings.objects.get_or_create(tenant=tenant)
    campos = []

    if tokens:
        config.tokens = {**(config.tokens or {}), **tokens}
        campos.append("tokens")

    for campo, valor in marca.items():
        setattr(config, campo, valor)
        campos.append(campo)

    config.save(update_fields=campos)
    return {"tokens": tokens, "marca": marca}


def variables_de_plantilla(plantilla) -> dict:
    """
    Las variables CSS que propone una plantilla, sin negocio de por medio.

    Lo usa el enlace de prueba: hay que pintar el aspecto de la plantilla sobre
    una tienda real sin haber escrito nada en ella. Las dos capas se mezclan en
    el mismo orden que en `aplicar_aspecto` —tema compartido, luego lo propio—
    porque tienen que dar el mismo resultado: si la previa y la adopcion
    difirieran, la previa no serviria para decidir.
    """
    from types import SimpleNamespace  # noqa: PLC0415

    from . import tema as motor  # noqa: PLC0415

    valores = {}
    if plantilla.tema_id:
        valores.update(plantilla.tema.valores or {})
    valores.update(plantilla.tema_valores or {})
    return motor.variables_css(tema=SimpleNamespace(valores=valores))
