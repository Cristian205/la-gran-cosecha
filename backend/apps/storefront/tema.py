"""
El aspecto de una tienda, resuelto.

Tres capas, y el orden importa:

    catálogo  ->  plantilla  ->  negocio

El catálogo (`TokenTema`) dice qué se puede ajustar y con qué valor de partida.
La plantilla que el negocio adoptó propone los suyos. Y el negocio, encima,
cambia lo que quiera. Cada capa solo pisa lo que declara: un tema que no
menciona el color del pie deja el del catálogo, no lo borra.

Lo que sale de aquí son variables CSS listas para el `<head>` de la tienda. No
se genera CSS ni clases: solo valores. La hoja de estilos decide qué hace con
ellos, que es lo que permite rediseñar la tienda sin tocar ninguna fila.
"""
from .models import TokenTema


def catalogo() -> dict[str, dict]:
    """Los tokens activos, por código."""
    return {
        t.codigo: {
            "variable": t.variable_css,
            "defecto": t.valor_por_defecto,
            "unidad": t.unidad,
        }
        for t in TokenTema.objects.filter(activo=True)
    }


def resolver(config=None, tema=None) -> dict[str, str]:
    """
    Los valores efectivos, por código de token.

    `config` es el `StoreSettings` del negocio y `tema` un preajuste opcional.
    Se devuelve por CÓDIGO y no por variable CSS porque es lo que el editor
    necesita para pintar sus controles; la traducción a variables la hace
    `variables_css()` justo antes de escribirlas.
    """
    disponibles = catalogo()
    valores = {codigo: datos["defecto"] for codigo, datos in disponibles.items()}

    for capa in (getattr(tema, "valores", None), getattr(config, "tokens", None)):
        for codigo, valor in (capa or {}).items():
            # Un token retirado del catálogo se ignora en vez de arrastrarse:
            # si la tienda ya no lo consume, aplicarlo no haría nada y solo
            # confundiría a quien lo viera en el editor.
            if codigo in disponibles and valor not in (None, ""):
                valores[codigo] = str(valor)

    return {c: v for c, v in valores.items() if v not in (None, "")}


def a_variables(valores, *, disponibles=None) -> dict[str, str]:
    """
    Traduce un `{código: valor}` a `{--variable: valor}`.

    Es la única traducción de código a variable del sistema, y por eso está
    suelta: la usan el tema del negocio (`variables_css`), el aspecto que
    propone una plantilla y —desde la fase 12— el estilo propio de cada bloque
    colocado. Tres sitios distintos escribiendo la misma correspondencia serían
    tres sitios donde olvidarse de poner la unidad.

    Un código que el catálogo ya no tiene se descarta en vez de arrastrarse:
    mismo criterio que `resolver()`. Si la tienda dejó de consumirlo, escribirlo
    no haría nada y solo confundiría a quien lo viera en el editor.
    """
    disponibles = catalogo() if disponibles is None else disponibles
    salida = {}
    for codigo, valor in (valores or {}).items():
        datos = disponibles.get(codigo)
        if datos is None or valor in (None, ""):
            continue
        unidad = datos["unidad"]
        # La unidad se añade solo si falta: guardar "16px" y guardar "16" en un
        # token de píxeles tienen que dar lo mismo.
        if unidad and not str(valor).endswith(unidad):
            valor = f"{valor}{unidad}"
        salida[datos["variable"]] = str(valor)
    return salida


def variables_css(config=None, tema=None) -> dict[str, str]:
    """Lo mismo que `resolver`, ya con el nombre de la variable y su unidad."""
    disponibles = catalogo()
    return a_variables(resolver(config, tema), disponibles=disponibles)
