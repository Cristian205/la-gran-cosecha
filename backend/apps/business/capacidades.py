"""
El catálogo de capacidades: qué se puede decir de un negocio.

Es la pieza que decide si Crynex sigue siendo un sistema o se convierte en diez
aplicaciones dentro de un repositorio, así que conviene ser explícito sobre la
regla que la gobierna:

    Se ramifica sobre CAPACIDADES, nunca sobre el sector.

`PerfilNegocio.sector` es una etiqueta —para mostrar en pantalla y para puntuar
en el alta— y nada más. En el momento en que aparezca un `if perfil.sector ==
"restaurante"`, añadir «floristería» dejará de ser un INSERT y volverá a ser
una rama de código, que es exactamente lo que esta arquitectura existe para
evitar. Hay un test que lo vigila.

# Por qué la lista es corta

Cada capacidad de aquí tiene un CONSUMIDOR REAL, nombrado en su `consumidor`.
Es tentador declarar veinte banderas de golpe —`catalogo_visual`,
`productos_compuestos`, `imprime_comanda`— porque describen bien los negocios
que uno imagina. Pero una bandera que nadie lee es peor que no tenerla: promete
una configurabilidad que no se cumple, y el día que alguien la active y no pase
nada, deja de fiarse del resto.

Es la misma disciplina que el motor de tiendas ya aplica a `TokenTema` —crear
un token obliga a consumir su variable CSS— y a `Bloque` —crear una fila obliga
a tener su componente—. Aquí: declarar una capacidad obliga a leerla en algún
sitio. Se añaden cuando la fase que las consume las necesita, no antes.
"""

#: Cada entrada: el consumidor es la razón de que exista.
CAPACIDADES = {
    "acepta_pedidos_online": {
        "nombre": "Acepta pedidos por la tienda",
        "descripcion": (
            "Los visitantes pueden armar un pedido y enviarlo. Apagado, la "
            "tienda sigue siendo un catálogo que se puede ver, pero no comprar."
        ),
        "defecto": True,
        "consumidor": "orders.CrearPedidoSerializer · tienda: oculta el carrito",
    },
    "controla_stock": {
        "nombre": "Lleva inventario",
        "descripcion": (
            "Los productos nuevos nacen contando existencias. No toca los que "
            "ya existen: eso se decide producto a producto."
        ),
        "defecto": False,
        "consumidor": "catalog.ProductoWriteSerializer: valor inicial de Producto.controla_stock",
    },
    "vende_por_peso": {
        "nombre": "Vende por peso o fracción",
        "descripcion": (
            "Media libra, tres cuartos de kilo. Los productos nuevos admiten "
            "cantidades fraccionarias."
        ),
        "defecto": False,
        "consumidor": "catalog.ProductoWriteSerializer: valor inicial de permite_fraccion",
    },
}

CLAVES_DE_CAPACIDAD = frozenset(CAPACIDADES)


def por_defecto() -> dict:
    """Las capacidades de un negocio que todavía no ha adoptado ningún preset."""
    return {codigo: datos["defecto"] for codigo, datos in CAPACIDADES.items()}


def normalizar(valores) -> dict:
    """
    Deja un diccionario de capacidades completo y sin nada de más.

    Rellena lo que falte con el valor por defecto y DESCARTA lo desconocido, en
    vez de rechazarlo. El criterio es el mismo que `tema.resolver()` aplica a
    los tokens retirados del catálogo: una capacidad que ya nadie lee no debe
    impedir guardar el resto del perfil, y arrastrarla solo confundiría a quien
    la viera en pantalla.
    """
    limpio = por_defecto()
    for codigo, valor in (valores or {}).items():
        if codigo in CLAVES_DE_CAPACIDAD:
            limpio[codigo] = bool(valor)
    return limpio


#: Política de existencias. Va aparte de las capacidades porque no es un
#: interruptor: son ajustes con valores propios que `inventory.mover()` lee.
POLITICA_STOCK_POR_DEFECTO = {
    # Permitir saldo negativo es una decisión de negocio real: una ferretería
    # prefiere vender y cuadrar después; una farmacia, no. Lo lee `mover()`.
    "permite_negativo": False,
}


def normalizar_politica(valores) -> dict:
    limpia = dict(POLITICA_STOCK_POR_DEFECTO)
    for codigo, valor in (valores or {}).items():
        if codigo in POLITICA_STOCK_POR_DEFECTO:
            limpia[codigo] = bool(valor)
    return limpia
