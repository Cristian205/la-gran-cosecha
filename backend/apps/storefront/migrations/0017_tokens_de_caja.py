"""
La caja tambien se configura, y con el mismo motor.

Es la respuesta a «una plantilla para el POS», y conviene decir por que no es
una `Plantilla`. El motor de plantillas compone PAGINAS: rutas publicas, con
bloques que se ordenan, SEO propio y visibilidad por dispositivo. El punto de
venta no tiene rutas ni SEO ni visitantes: es UNA pantalla que usa la misma
persona ochenta veces al dia. Meterla en el constructor le daria a un cajero la
posibilidad de dejarse la caja sin selector un martes por la tarde.

Lo que si comparte con la tienda es la IDENTIDAD, y eso es lo que se hace aqui:

    color, tipografia y redondeo   ya los tenia el negocio. La caja los lee.
    disposicion y densidad          son propios del mostrador. Tres tokens.

Asi que la caja de una boutique es rosa y espaciada, y la de una ferreteria
gris y apretada, sin una sola rama en el codigo del POS — exactamente la misma
tecnica con que `perfil_pos` decide sus cuatro zonas desde la fase 10.

# Por que TRES y no ocho

La tentacion era declarar de golpe todo lo que se puede mover de una pantalla:
alto de las fichas, tamano del boton de cobro, si hay foto, si el total va
arriba. Dos de esos YA los decide `perfil_pos` —`muestra_imagenes` y
`busqueda`—, y anadirlos aqui daria dos perillas peleandose por lo mismo, que
es peor que no tener ninguna. Es la misma criba que dejo los tokens de densidad
de la tienda en dos y no en cuatro.

Los tres que quedan tienen consumidor nombrado en `admin-panel/src/index.css`, y
hay un test que lo comprueba.

# El que no es un valor

`caja-disposicion` no nombra un valor sino una MAQUETA, y una variable CSS no
puede mover el carrito de sitio. Viaja como atributo —`data-caja`— igual que
`estilo-tarjeta` viaja como `data-tarjeta` en la tienda. Es la misma excepcion
y esta declarada en el test que vigila que ningun token quede huerfano.
"""
from django.db import migrations

TOKENS = [
    {
        "codigo": "caja-disposicion",
        "nombre": "Donde va el carrito",
        "descripcion": "Como se reparte la pantalla de la caja.",
        "grupo": "CAJA",
        "tipo": "OPCION",
        "variable_css": "--caja-disposicion",
        "valor_por_defecto": "derecha",
        "unidad": "",
        "orden": 10,
        "opciones": [
            {"valor": "derecha", "nombre": "Carrito a la derecha"},
            {"valor": "izquierda", "nombre": "Carrito a la izquierda"},
            {"valor": "abajo", "nombre": "Carrito abajo — pantallas pequenas"},
        ],
    },
    {
        "codigo": "caja-columnas",
        "nombre": "Productos por fila",
        "descripcion": "En el selector de la caja, cuando muestra fotos.",
        "grupo": "CAJA",
        "tipo": "OPCION",
        "variable_css": "--caja-columnas",
        "valor_por_defecto": "4",
        "unidad": "",
        "orden": 20,
        "opciones": [
            {"valor": "3", "nombre": "Tres — fichas grandes"},
            {"valor": "4", "nombre": "Cuatro"},
            {"valor": "5", "nombre": "Cinco"},
            {"valor": "6", "nombre": "Seis — mucho catalogo"},
        ],
    },
    {
        "codigo": "caja-densidad",
        "nombre": "Aire de la caja",
        "descripcion": "Multiplica los espacios de la pantalla de venta.",
        "grupo": "CAJA",
        "tipo": "OPCION",
        "variable_css": "--caja-densidad",
        "valor_por_defecto": "1",
        "unidad": "",
        "orden": 30,
        "opciones": [
            {"valor": "0.85", "nombre": "Compacta — cabe mas"},
            {"valor": "1", "nombre": "Normal"},
            {"valor": "1.2", "nombre": "Amplia — pantalla tactil"},
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
    # no estan en el catalogo, asi que apagarlos ya devuelve todas las cajas a
    # su reparto de siempre sin tocar lo que cada negocio guardo. Retirar es
    # archivar, aqui tambien.
    TokenTema.objects.filter(
        codigo__in=[t["codigo"] for t in TOKENS]
    ).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0016_grupo_caja")]

    operations = [migrations.RunPython(sembrar, retirar)]
