"""
Pone al dia el catalogo con lo que los bloques aceptan de verdad.

La siembra de la 0002 declaro variantes que ningun componente implementaba
—`productos-destacados` ofrecia "carrusel", `categorias-destacadas` ofrecia
"tiras"— y dejo siete bloques sin esquema de propiedades. Eso convertia el
catalogo en una promesa incumplida: el constructor habria mostrado un
desplegable que no cambia nada.

Ahora los doce declaran exactamente lo que su componente lee. `esquema_props`
no es documentacion: valida en el servidor y dibuja el panel del constructor,
asi que separarlo del componente es separar el formulario de lo que guarda.

Se actualiza con `update` y no con `get_or_create` porque las filas ya existen
desde la 0002; crearlas de nuevo no habria hecho nada.
"""
from django.db import migrations


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


#: Las tres propiedades del encabezado que comparten casi todos los bloques.
#: Se componen en vez de repetirse para que anadir una cuarta no sea doce
#: ediciones.
def encabezado(kicker="", titulo="", subtitulo=""):
    return {
        "kicker": texto("Antetitulo", kicker),
        "titulo": texto("Titulo", titulo),
        "subtitulo": texto("Texto a la derecha", subtitulo),
    }


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


REJILLA_O_CARRUSEL = [
    {"codigo": "rejilla", "nombre": "Rejilla"},
    {"codigo": "carrusel", "nombre": "Carrusel horizontal"},
]

CATALOGO = {
    "carrusel-promociones": {
        "esquema_props": objeto(
            autoplay={
                "tipo": "boolean",
                "titulo": "Rotar solo",
                "default": True,
                "ayuda": "Apagalo si solo hay una banderola que importe.",
            },
            segundos=numero(
                "Segundos por banderola", 6, minimo=2, maximo=30,
                ayuda="Entre 2 y 30. Fuera de ese rango se acota.",
            ),
        ),
        "variantes": [
            {"codigo": "completo", "nombre": "Ancho completo"},
            {"codigo": "contenido", "nombre": "Dentro del contenedor"},
        ],
    },
    "insignias-confianza": {
        "esquema_props": objeto(
            limite=numero("Cuantas mostrar", ayuda="Vacio las muestra todas."),
        ),
        "variantes": [
            {"codigo": "franja", "nombre": "Franja unica"},
            {"codigo": "tarjetas", "nombre": "Tarjetas sueltas"},
        ],
    },
    "repetir-pedido": {
        "esquema_props": objeto(
            titulo=texto("Titulo", "Pedimos lo mismo que la ultima vez?"),
            boton_texto=texto("Texto del boton", "Repetir pedido"),
        ),
        "variantes": [],
    },
    "productos-destacados": {
        "esquema_props": objeto(
            **encabezado("Los preferidos", "Lo que mas piden los negocios como el tuyo",
                         "Disponibilidad confirmada"),
            limite=numero("Cuantos productos", 8, maximo=24),
        ),
        "variantes": REJILLA_O_CARRUSEL,
    },
    "ofertas-semana": {
        "esquema_props": objeto(
            **encabezado("Por tiempo limitado", "Ofertas de la semana",
                         "Precios que no se repiten"),
            limite=numero("Cuantas ofertas", maximo=24),
        ),
        "variantes": REJILLA_O_CARRUSEL,
    },
    "categorias-destacadas": {
        "esquema_props": objeto(
            **encabezado("Catalogo", "Compra por categoria",
                         "Encuentra justo lo que necesitas"),
            limite=numero("Cuantas categorias", maximo=24),
        ),
        "variantes": [
            {"codigo": "rejilla", "nombre": "Rejilla"},
            {"codigo": "tiras", "nombre": "Tiras horizontales"},
        ],
    },
    "por-que-elegirnos": {
        "esquema_props": objeto(
            **encabezado("Confianza", "Por que comprar con nosotros?"),
            limite=numero("Cuantos beneficios", maximo=12),
        ),
        "variantes": [],
    },
    "estadisticas": {
        "esquema_props": objeto(
            **encabezado(),
            limite=numero("Cuantas cifras", maximo=8),
        ),
        "variantes": [],
    },
    "testimonios": {
        "esquema_props": objeto(
            **encabezado("Clientes", "Lo que dicen nuestros clientes"),
            limite=numero("Cuantos testimonios", maximo=12),
        ),
        "variantes": REJILLA_O_CARRUSEL,
    },
    "como-funciona": {
        "esquema_props": objeto(
            **encabezado("Como funciona", "Pedir es simple"),
            pasos={
                "tipo": "array",
                "titulo": "Pasos",
                "ayuda": "Anade o quita los que quieras: ya no son tres fijos.",
                "items": objeto(
                    titulo=texto("Titulo"),
                    texto=texto("Texto"),
                    icono={
                        "tipo": "enum",
                        "titulo": "Icono",
                        "opciones": ["search", "clipboard", "truck", "package", "shield"],
                        "default": "search",
                    },
                ),
            },
        ),
        "variantes": [],
    },
    "cotizacion-rapida": {
        "esquema_props": objeto(
            titulo=texto("Titulo"),
            texto=texto("Texto"),
        ),
        "variantes": [],
    },
    "cta-banda": {
        "esquema_props": objeto(
            titulo=texto("Titulo"),
            texto=texto("Texto"),
            boton_texto=texto("Texto del boton", "Ir a la tienda"),
            boton_href=texto("Enlace del boton", "/tienda",
                             "Una ruta de la tienda o una direccion completa."),
        ),
        "variantes": [],
    },
}


def actualizar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for codigo, datos in CATALOGO.items():
        Bloque.objects.filter(codigo=codigo).update(**datos)


def revertir(apps, schema_editor):
    """
    No devuelve los esquemas viejos: eran incompletos y prometian variantes que
    no existen. Volver a ellos seria restaurar el problema.
    """


class Migration(migrations.Migration):
    dependencies = [("storefront", "0002_siembra_bloques_y_plantilla")]

    operations = [migrations.RunPython(actualizar, revertir)]
