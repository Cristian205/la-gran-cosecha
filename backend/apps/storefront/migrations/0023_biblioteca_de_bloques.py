"""
Seis bloques nuevos y las cuatro variantes que faltaban.

Es la parte del rediseno del motor que NO cambia el motor. Nada de esto tocó el
lienzo, ni el validador, ni el registro mas alla de sus seis filas: era la
promesa que `Bloque` lleva escrita desde la fase 11 —«un bloque nuevo es una
fila aqui y un componente alli»— y esta migracion la cobra.

# Lo que faltaba de verdad

`pie` declaraba CERO variantes. El encargo pedia al menos dos en cabecera,
portada, carruseles y pie; los tres primeros las tenian y el pie se habia
quedado con una sola forma desde el principio, asi que toda tienda del motor
llevaba el mismo pie de cuatro columnas — incluida la boutique de ocho
productos, que no tiene doce enlaces que poner.

`estadisticas` y `por-que-elegirnos` estaban peor: sus componentes IMPORTABAN
`claseDeVariante` y no lo usaban. Estaba escrito el mecanismo y no habia
ninguna variante que elegir.

# Los bloques nuevos, y por que estos

Cada uno cubre un hueco que se veia al intentar componer una tienda que no
fuera la primera:

    grid-productos      los otros dos bloques de catalogo tienen un CRITERIO
                        escrito dentro —lo mas vendido, lo que esta en oferta—.
                        No habia forma de decir «los de la categoria Cafes».
    banner-promocional  el carrusel es la cabecera de la tienda; esto es una
                        promocion suelta que se coloca donde haga falta.
    galeria             para las tiendas donde el producto se vende mirandolo.
    marcas              prueba social de distribuidor: no «a otros les fue
                        bien» sino «los que ya conoces confian aqui».
    boletin             el unico que necesito tabla: `contact.Suscriptor`. Un
                        formulario que recoge correos y no los guarda es peor
                        que no tener el formulario.
    separador           hasta ahora, cortar visualmente una pagina obligaba a
                        que alguna seccion trajera su propio borde, asi que el
                        corte era propiedad de la seccion y no de la pagina:
                        reordenar dejaba la linea en el sitio equivocado.

# El que NO esta

`contenedor`. Lo pide el encargo y hace falta, pero necesita que la composicion
admita HIJOS y hoy es una lista plana. Meterlo ahora seria un bloque que se
puede colocar y no puede contener nada. Va con el anidamiento.
"""
from django.db import migrations


# --------------------------------------------------------------------------
# Los mismos ayudantes que la 0003. Copiados y no importados: una migracion
# que importa de otra hace lo que aquella diga DENTRO DE UN ANO, no lo que
# decia el dia que se escribio.
# --------------------------------------------------------------------------
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def numero(titulo, defecto=None, minimo=1, maximo=None, ayuda=""):
    campo = {"tipo": "number", "titulo": titulo, "minimo": minimo}
    if defecto is not None:
        campo["default"] = defecto
    if maximo is not None:
        campo["maximo"] = maximo
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


def encabezado(kicker="", titulo="", subtitulo=""):
    return {
        "kicker": texto("Antetitulo", kicker),
        "titulo": texto("Titulo", titulo),
        "subtitulo": texto("Texto a la derecha", subtitulo),
        "centrado": bandera("Encabezado centrado", False),
    }


# --------------------------------------------------------------------------
# 1. Las variantes que faltaban
# --------------------------------------------------------------------------
VARIANTES_NUEVAS = {
    "pie": [
        {"codigo": "columnas", "nombre": "Columnas"},
        {"codigo": "minimo", "nombre": "Minimo (una fila)"},
    ],
    "cta-banda": [
        {"codigo": "banda", "nombre": "Franja"},
        {"codigo": "tarjeta", "nombre": "Tarjeta"},
    ],
    "estadisticas": [
        {"codigo": "franja", "nombre": "Franja seguida"},
        {"codigo": "tarjetas", "nombre": "Tarjetas sueltas"},
    ],
    "por-que-elegirnos": [
        {"codigo": "rejilla", "nombre": "Rejilla"},
        {"codigo": "lista", "nombre": "Lista compacta"},
    ],
}


# --------------------------------------------------------------------------
# 2. Los bloques nuevos
# --------------------------------------------------------------------------
BASE = [
    "bloque-fondo",
    "color-texto",
    "color-superficie",
    "color-borde",
    "seccion-espacio",
    "radio-tarjeta",
    "sombra-fuerza",
    "sombra-tinte",
    "titulo-peso",
    "titulo-escala",
]

NUEVOS = {
    "grid-productos": {
        "nombre": "Rejilla de productos",
        "descripcion": "Productos del catalogo, eligiendo la categoria y cuantos.",
        "categoria": "CATALOGO",
        "icono": "layout-grid",
        "esquema_props": objeto(
            **encabezado(),
            categoria_id=numero(
                "Categoria",
                minimo=1,
                ayuda="Vacio = todo el catalogo. El id sale de Catalogo > Categorias.",
            ),
            limite=numero("Cuantos mostrar", 8, minimo=1, maximo=24),
            orden={
                "tipo": "enum",
                "titulo": "Orden",
                "opciones": ["recientes", "precio_asc", "precio_desc", "nombre"],
                "default": "recientes",
            },
        ),
        "variantes": [
            {"codigo": "rejilla", "nombre": "Rejilla"},
            {"codigo": "carrusel", "nombre": "Carrusel horizontal"},
        ],
        "tokens_admitidos": BASE + ["columnas-catalogo", "estilo-tarjeta", "densidad-escala"],
        "orden": 35,
    },
    "banner-promocional": {
        "nombre": "Banner promocional",
        "descripcion": "Una promocion con su imagen y su boton, donde haga falta.",
        "categoria": "CONVERSION",
        "icono": "image",
        "esquema_props": objeto(
            kicker=texto("Antetitulo", ayuda="«Solo hasta el viernes», «Nuevo»."),
            titulo=texto("Titulo"),
            texto=texto("Texto"),
            imagen_url=texto("Imagen (URL)"),
            imagen_alt=texto(
                "Texto alternativo",
                ayuda="Lo que lee quien no ve la imagen. Vacio la deja sin describir.",
            ),
            boton_texto=texto("Texto del boton"),
            boton_href=texto("Enlace del boton"),
            oscurecer=numero(
                "Oscurecer la foto",
                35,
                minimo=0,
                maximo=100,
                ayuda="Solo en «foto de fondo»: sube hasta que el texto se lea.",
            ),
            invertido=bandera(
                "Imagen a la derecha",
                False,
                ayuda="Para alternar dos banners seguidos sin que parezcan el mismo.",
            ),
        ),
        "variantes": [
            {"codigo": "partido", "nombre": "Imagen y texto"},
            {"codigo": "cubierto", "nombre": "Foto de fondo"},
        ],
        "tokens_admitidos": BASE + ["radio-boton"],
        "orden": 45,
    },
    "galeria": {
        "nombre": "Galeria",
        "descripcion": "Un muro de imagenes. Para lo que se vende mirandolo.",
        "categoria": "CONTENIDO",
        "icono": "images",
        "esquema_props": objeto(
            **encabezado(),
            imagenes={
                "tipo": "array",
                "titulo": "Imagenes",
                "items": objeto(
                    url=texto("URL"),
                    alt=texto("Texto alternativo"),
                    pie=texto("Pie de foto"),
                ),
            },
        ),
        "variantes": [
            {"codigo": "mosaico", "nombre": "Mosaico"},
            {"codigo": "tira", "nombre": "Tira desplazable"},
        ],
        "tokens_admitidos": BASE,
        "orden": 55,
    },
    "marcas": {
        "nombre": "Marcas",
        "descripcion": "Los logotipos de las marcas con las que trabaja el negocio.",
        "categoria": "PRUEBA_SOCIAL",
        "icono": "badge-check",
        "esquema_props": objeto(
            **encabezado(),
            marcas={
                "tipo": "array",
                "titulo": "Marcas",
                "items": objeto(
                    logo_url=texto("Logotipo (URL)"),
                    nombre=texto("Nombre"),
                    href=texto("Enlace"),
                ),
            },
            atenuar=bandera(
                "En gris hasta pasar el raton",
                True,
                ayuda="Veinte logotipos a todo color compiten con el producto.",
            ),
        ),
        "variantes": [
            {"codigo": "tira", "nombre": "Tira"},
            {"codigo": "rejilla", "nombre": "Rejilla"},
        ],
        "tokens_admitidos": BASE,
        "orden": 65,
    },
    "boletin": {
        "nombre": "Boletin",
        "descripcion": "Recoge correos para escribirles. Los guarda en la lista del negocio.",
        "categoria": "CONVERSION",
        "icono": "mail",
        "esquema_props": objeto(
            kicker=texto("Antetitulo"),
            titulo=texto("Titulo", "Enterate de lo nuevo"),
            texto=texto(
                "Texto", "Te escribimos cuando hay algo que vale la pena, no cada semana."
            ),
            boton_texto=texto("Texto del boton", "Suscribirme"),
            nota=texto(
                "Aviso legal",
                ayuda="Lo que el negocio tenga que decir. El bloque no lo inventa.",
            ),
            centrado=bandera("Centrado", False),
        ),
        "variantes": [
            {"codigo": "banda", "nombre": "Franja tenida"},
            {"codigo": "tarjeta", "nombre": "Tarjeta"},
        ],
        "tokens_admitidos": BASE + ["radio-boton"],
        # Uno por pagina: dos formularios de suscripcion en la misma pantalla
        # no duplican las altas, duplican la duda de en cual apuntarse.
        "unico_por_pagina": True,
        "orden": 75,
    },
    "separador": {
        "nombre": "Separador",
        "descripcion": "Una linea o un hueco entre dos secciones.",
        "categoria": "ESTRUCTURA",
        "icono": "minus",
        "esquema_props": objeto(
            espacio=numero(
                "Cuanto separa",
                2,
                minimo=0,
                maximo=10,
                ayuda="Se multiplica por la densidad de la tienda.",
            ),
        ),
        "variantes": [
            {"codigo": "linea", "nombre": "Linea"},
            {"codigo": "aire", "nombre": "Solo espacio"},
            {"codigo": "punto", "nombre": "Puntos"},
        ],
        # Sin tokens propios: lo unico que tiene es su espacio, y ese ya es una
        # propiedad. Darle `bloque-fondo` seria una franja de color disfrazada
        # de separador.
        "tokens_admitidos": [],
        "orden": 95,
    },
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")

    for codigo, variantes in VARIANTES_NUEVAS.items():
        Bloque.objects.filter(codigo=codigo).update(variantes=variantes)

    for codigo, datos in NUEVOS.items():
        Bloque.objects.update_or_create(codigo=codigo, defaults=datos)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")

    for codigo in VARIANTES_NUEVAS:
        Bloque.objects.filter(codigo=codigo).update(variantes=[])

    # Se DESACTIVAN en vez de borrarse. Un bloque borrado que alguna pagina
    # tenga puesto haria que esa pagina dejara de validar y el negocio no
    # podria guardar su tienda; desactivado, el lienzo lo salta y el editor lo
    # marca como desconocido. Retirar es archivar, no borrar.
    Bloque.objects.filter(codigo__in=NUEVOS).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0022_que_admite_cada_bloque")]

    operations = [migrations.RunPython(aplicar, revertir)]
