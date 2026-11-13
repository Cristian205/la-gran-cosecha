"""
Como se ve el panel administrativo de este negocio. No la tienda.

Mismo criterio que `apps/pos/aspecto.py` para la caja: un negocio tiene UNA
identidad, y el panel es otra superficie que la lleva puesta, no otra marca.
Nada de un segundo catalogo ni de una segunda fila de configuracion — eso es
precisamente el fallo contra el que esta escrita media arquitectura de este
sistema (ver `TokenTema.Grupo.CAJA`).

Lo que viaja es deliberadamente poco. El panel tiene sus tablas, su modo
oscuro y sus contrastes ya revisados, y repintar su cromo entero — botones,
insignias, anillos de foco — con el color de una boutique lo haria mas
bonito y menos legible: un boton necesita saber contra que texto se lee, y
esa decision ya esta tomada. Cuanto aire tiene la interfaz y que tan marcada
es su sombra, en cambio, no comprometen ningun contraste — son la misma
perilla que el negocio ya gira para su tienda en Contenido -> Apariencia,
solo que ahora tambien la escucha el panel.
"""
from apps.storefront import tema as motor

#: Cada uno tiene un consumidor nombrado en `admin-panel/src/index.css`.
VARIABLES = ("--densidad-escala", "--sombra-fuerza")


def variables_del_panel(config) -> dict[str, str]:
    """Las variables del tema del negocio que el panel administrativo sabe usar."""
    return {
        var: valor
        for var, valor in motor.variables_css(config).items()
        if var in VARIABLES
    }


# ==========================================================================
# EL NOMBRE DEL NEGOCIO, CON LA LETRA DE SU TIENDA
# ==========================================================================
#: Las fuentes de titulos que la tienda sabe cargar (token `fuente-titulos`,
#: ver `tienda/src/lib/tema.ts → FUENTES_TITULO`). El panel traduce la clave
#: a la familia y carga la misma hoja de Google.
FUENTES_TITULO = ("playfair", "cormorant", "dm-serif", "fraunces")

#: Variantes de cabecera que fijan su propia letra para el nombre, en vez de
#: la de los titulos. «comercio» lo escribe en Fraunces italica (ver
#: `.navbar--comercio .marca-txt` en `tienda/src/app/global.css`).
LETRA_DE_CABECERA = {"comercio": {"fuente": "fraunces", "italica": True}}


def _variante_de_cabecera(tenant) -> str:
    """La variante del bloque `cabecera` del armazon PUBLICADO, o ''."""
    from apps.storefront.models import VersionPagina

    if tenant is None:
        return ""
    version = (
        VersionPagina.all_tenants.filter(
            tenant=tenant, pagina__ruta="/_layout", estado=VersionPagina.Estado.PUBLICADA
        )
        .only("composicion")
        .first()
    )
    for bloque in (version.composicion if version else None) or []:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera":
            return str(bloque.get("variante") or "")
    return ""


def tipografia_de_marca(config) -> dict:
    """
    Como escribe la tienda el nombre del negocio en su cabecera, para que el
    panel lo escriba igual: `{"fuente": clave, "italica": bool}`.

    Primero manda la cabecera publicada (hay variantes con letra propia);
    despues, la tipografia de titulos elegida en Apariencia. «heredada» quiere
    decir la fuente del texto, que el panel ya usa (`--fuente-panel`).
    """
    fija = LETRA_DE_CABECERA.get(_variante_de_cabecera(getattr(config, "tenant", None)))
    if fija:
        return dict(fija)
    titulos = motor.resolver(config).get("fuente-titulos", "heredada")
    return {"fuente": titulos if titulos in FUENTES_TITULO else "heredada", "italica": False}
