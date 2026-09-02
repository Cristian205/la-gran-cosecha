"""
Como se ve la caja de este negocio.

Es la otra mitad de `business/perfil_pos.py`. Aquella decide QUE hace la caja
—como se busca, que se pregunta por linea, que panel lleva al lado—; esto
decide como SE VE. Van separadas porque se contestan en sitios distintos: el
perfil lo propone el preset del sector y esto sale del tema del negocio, que es
el mismo que viste su tienda.

    El negocio tiene UNA identidad. El mostrador es otra superficie que la
    lleva puesta, no otra marca.

Por eso los tokens de la caja viven en el catalogo de `storefront.TokenTema` y
no en uno propio: un segundo catalogo daria dos sitios donde elegir el color y
el segundo se quedaria viejo.

# Que se manda y que no

Se mandan CINCO cosas, no el tema entero. La tentacion era devolver todas las
variables resueltas y dejar que la pantalla cogiera lo que quisiera, pero el
panel de administracion no es la tienda: tiene su propio modo oscuro, sus
contrastes revisados y sus tablas, y retenir su cromo entero con el color de
una boutique lo haria mas bonito y menos legible.

Asi que la caja lleva el ACENTO del negocio —el boton de cobrar, el producto
elegido— y sus dos ajustes de reparto. Cada uno tiene un consumidor nombrado en
`admin-panel/src/index.css`, y hay un test que lo comprueba.
"""
from apps.storefront import tema as motor
from apps.storefront.models import TokenTema

#: Los tokens del grupo CAJA que viajan como variable CSS. `caja-disposicion`
#: no esta: nombra una maqueta, no un valor, y viaja como atributo — la misma
#: excepcion que `estilo-tarjeta` en la tienda.
VARIABLES = ("--caja-columnas", "--caja-densidad")

#: Los repartos que la hoja del panel sabe dibujar. Uno que no este cae al de
#: siempre en vez de dejar la caja sin maquetar: el catalogo de tokens y el
#: panel se despliegan por separado y pueden no coincidir un rato.
DISPOSICIONES = ("derecha", "izquierda", "abajo")
DISPOSICION_POR_DEFECTO = "derecha"


def aspecto(tenant) -> dict:
    """
    El acento y el reparto de la caja de este negocio.

    Nunca falla: sin configuracion de tienda, sin tokens o con un valor que el
    panel no conoce, devuelve lo de siempre. Una caja que no se pinta no vende,
    asi que ninguna decision de aspecto puede impedir abrirla.
    """
    from apps.content.models import StoreSettings  # noqa: PLC0415 — evita el ciclo

    config = StoreSettings.objects.filter(tenant=tenant).first()

    resueltos = motor.resolver(config)
    variables = {
        var: valor
        for var, valor in motor.variables_css(config).items()
        if var in VARIABLES
    }

    elegida = resueltos.get("caja-disposicion", DISPOSICION_POR_DEFECTO)
    if elegida not in DISPOSICIONES:
        elegida = DISPOSICION_POR_DEFECTO

    # El acento sale de los campos de marca y no de un token, por lo mismo que
    # en la tienda: `color_primario` es de donde cuelga la identidad del
    # negocio desde antes del motor de temas, y duplicarlo como token daria dos
    # sitios donde cambiar el color.
    if config is not None:
        if config.color_primario:
            variables["--caja-marca"] = config.color_primario
        if config.color_primario_texto:
            variables["--caja-marca-texto"] = config.color_primario_texto

    return {"variables": variables, "disposicion": elegida}


def catalogo_de_caja() -> list:
    """Los tokens del grupo CAJA, para que el panel pinte sus controles."""
    return list(
        TokenTema.objects.filter(activo=True, grupo=TokenTema.Grupo.CAJA).values(
            "codigo", "nombre", "descripcion", "valor_por_defecto", "opciones"
        )
    )
