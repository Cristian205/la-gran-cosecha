"""
Cuanto aire tiene la tienda.

Es la ultima perilla que separa un sector de otro sin escribir un componente:
una ferreteria con trescientas referencias necesita verlas juntas para
compararlas; una boutique necesita que cada producto tenga sitio. Hasta ahora
eso solo se podia conseguir con dos hojas de estilo.

# Solo dos tokens, y por que no cuatro

La tentacion era declarar de golpe todo lo que suena a densidad: espacio entre
secciones, ancho del contenido, alto de las imagenes, separacion de las
tarjetas. Dos de esos YA existen —`seccion-espacio` y `contenedor-ancho`, de la
siembra original— y anadirlos otra vez daria dos perillas peleandose por la
misma propiedad, que es peor que no tener ninguna.

Y el alto de las imagenes se queda fuera a proposito: lo decide el estilo de
tarjeta (`estilo-tarjeta`), y un token que compitiera con el dejaria a la
tienda con dos cosas discutiendo el mismo `aspect-ratio`. Cuando dos ajustes
pueden contradecirse, uno de los dos sobra.

Asi que dos, cada uno con un consumidor claro en la hoja:

    densidad-escala     multiplica los espacios de toda la tienda a la vez
    columnas-catalogo   cuantos productos por fila en escritorio
"""
from django.db import migrations

TOKENS = [
    {
        "codigo": "densidad-escala",
        "nombre": "Aire de la tienda",
        "descripcion": "Multiplica los espacios de toda la tienda a la vez.",
        "grupo": "DENSIDAD",
        "tipo": "OPCION",
        "variable_css": "--densidad-escala",
        "valor_por_defecto": "1",
        "unidad": "",
        "orden": 10,
        "opciones": [
            {"valor": "0.85", "nombre": "Compacto — mucho catalogo"},
            {"valor": "1", "nombre": "Normal"},
            {"valor": "1.15", "nombre": "Amplio"},
            {"valor": "1.3", "nombre": "Muy amplio — pocas piezas"},
        ],
    },
    {
        "codigo": "columnas-catalogo",
        "nombre": "Productos por fila",
        "descripcion": "En pantallas anchas. En movil siempre son dos.",
        "grupo": "DENSIDAD",
        "tipo": "OPCION",
        "variable_css": "--columnas-catalogo",
        "valor_por_defecto": "4",
        "unidad": "",
        "orden": 20,
        "opciones": [
            {"valor": "3", "nombre": "Tres — productos grandes"},
            {"valor": "4", "nombre": "Cuatro"},
            {"valor": "5", "nombre": "Cinco — catalogo amplio"},
        ],
    },
]


def sembrar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")
    for datos in TOKENS:
        TokenTema.objects.get_or_create(
            codigo=datos["codigo"],
            defaults={k: v for k, v in datos.items() if k != "codigo"},
        )


def retirar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")
    # Se desactivan en vez de borrarse: `tema.resolver()` ignora los tokens que
    # no estan en el catalogo, asi que apagarlos ya devuelve todas las tiendas
    # a su espaciado de siempre sin tocar lo que cada negocio guardo.
    TokenTema.objects.filter(
        codigo__in=[t["codigo"] for t in TOKENS]
    ).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0012_grupo_densidad")]

    operations = [migrations.RunPython(sembrar, retirar)]
