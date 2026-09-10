"""
Que puede retocar cada bloque por su cuenta.

Es la mitad de datos del estilo por bloque: la 0020 puso el campo y esto dice
que lleva cada uno. Va como migracion y no escrito en el codigo por la misma
razon que el catalogo de bloques entero — anadir una perilla a un bloque tiene
que ser un UPDATE, no un despliegue.

# Por que es lista blanca y no «todos los tokens»

Porque una perilla que no hace nada es peor que no tenerla. `columnas-catalogo`
en un pie de pagina se puede mover y no pasa nada, y quien lo pruebe dejara de
fiarse del resto del panel. Es la misma disciplina de `capacidades.py` y del
propio catalogo de tokens: declarar obliga a que alguien lo consuma.

# Los tres que NO estan en ninguna lista, y por que

`fuente-titulos`   la familia se carga UNA vez en el `<head>`, y quien decide
                   cual es la configuracion del negocio. Un bloque que pidiera
                   otra la nombraria sin que estuviera cargada, asi que se
                   veria la de respaldo y pareceria que el ajuste no funciona.
                   Cuando el cargador sepa recorrer los bloques, entra.

`navbar-alto`      lo lee la barra de filtros de la tienda para quedarse pegada
                   justo debajo de la cabecera. Es una medida COMPARTIDA entre
                   dos bloques distintos, asi que no es de ninguno.

`contenedor-ancho` lo mismo un piso mas arriba: define los margenes de toda la
                   pagina. Un bloque que lo cambiara solo para el desalinearia
                   su contenido con el de arriba y el de abajo, que es
                   exactamente lo que nadie quiere y todo el mundo prueba una
                   vez.
"""
from django.db import migrations

#: Lo que casi cualquier seccion quiere poder tocar: su fondo, su texto, sus
#: bordes, cuanto aire tiene y cuanta sombra.
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

#: Y ademas, si la seccion pinta productos: como se rejillan y con que aspecto.
CATALOGO = BASE + ["columnas-catalogo", "estilo-tarjeta", "densidad-escala"]

ADMITIDOS = {
    # --- estructura -------------------------------------------------------
    # La cabecera tiene su propio juego: retocarla con `bloque-fondo` no haria
    # nada porque la barra no se dibuja con el.
    "cabecera": [
        "navbar-fondo",
        "navbar-fondo-2",
        "navbar-texto",
        "navbar-opacidad",
        "navbar-desenfoque",
    ],
    "barra-categorias": ["bloque-fondo", "color-texto", "color-borde", "seccion-espacio"],
    "portada": [
        "bloque-fondo",
        "color-texto",
        "seccion-espacio",
        "titulo-peso",
        "titulo-escala",
        "radio-boton",
        "sombra-fuerza",
        "sombra-tinte",
    ],
    "carrusel-promociones": ["seccion-espacio", "radio-tarjeta", "sombra-fuerza"],
    # El pie ya tenia sus dos colores propios desde el motor de temas; aqui
    # pasan a poder fijarse en el bloque y no solo en toda la tienda.
    "pie": ["footer-fondo", "footer-texto", "color-borde", "seccion-espacio"],

    # --- catalogo ---------------------------------------------------------
    "productos-destacados": CATALOGO,
    "ofertas-semana": CATALOGO,
    "categorias-destacadas": CATALOGO,

    # --- contenido y prueba social ---------------------------------------
    "publicos-objetivo": BASE,
    "acceso": BASE,
    "por-que-elegirnos": BASE,
    "como-funciona": BASE,
    "insignias-confianza": BASE,
    "estadisticas": BASE,
    "testimonios": BASE,

    # --- conversion -------------------------------------------------------
    "cta-banda": BASE + ["radio-boton"],
    "cotizacion-rapida": BASE + ["radio-boton"],
    "repetir-pedido": BASE + ["radio-boton"],
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for codigo, tokens in ADMITIDOS.items():
        Bloque.objects.filter(codigo=codigo).update(tokens_admitidos=tokens)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    # Vaciarlo devuelve el comportamiento de antes: los bloques obedecen solo
    # al tema del negocio. Las composiciones que llevaran estilo propio no se
    # tocan; `composicion._estilo` lo descarta solo al volver a guardar, que es
    # justo lo que debe pasar con un token que ya no se admite.
    Bloque.objects.update(tokens_admitidos=[])


class Migration(migrations.Migration):

    dependencies = [("storefront", "0021_tokens_de_sombra_y_espaciado")]

    operations = [migrations.RunPython(aplicar, revertir)]
