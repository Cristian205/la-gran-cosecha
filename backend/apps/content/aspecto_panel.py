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
