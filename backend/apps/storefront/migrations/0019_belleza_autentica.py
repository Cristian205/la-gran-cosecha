"""
«Belleza» deja de parecerse a La Gran Cosecha.

La primera version de esta plantilla se veia distinta y sonaba igual, y mirando
la vista previa se entiende por que: reusaba las secciones de la distribuidora
—ofertas de la semana, testimonios, la banda final— y arrastraba dos detalles
escritos a mano en el codigo que ninguna plantilla podia cambiar. Esta migracion
cierra las dos cosas.

# Lo que estaba escrito en el codigo y ahora es dato

    la hoja del antetitulo    `Portada` pintaba un 🌿 literal. Eso ataba la
                              portada de CUALQUIER tienda a la identidad de una
                              distribuidora de alimentos: una perfumeria salia
                              con una hojita encima del titular y nadie podia
                              quitarla sin desplegar. Ahora es `kicker_icono`.

    el carrito del boton      «Comprar ahora» con un carrito dibujado es de una
                              tienda de abastos. Una boutique quiere una flecha.
                              Ahora es `cta_icono`.

Los dos valores por defecto conservan lo de antes, asi que ninguna tienda en
marcha cambia de aspecto: lo que cambia es que ahora se pueden mover.

# Lo que gana la cabecera

El boton de categorias y el importe en el carrito. Los dos son OPCIONALES y
nacen apagados, por la razon de siempre: una ferreteria de treinta referencias
no quiere un desplegable de categorias, y una distribuidora cuyo precio depende
del dia no quiere un total en la barra invitando a discutirlo antes de
confirmar el pedido.

# La composicion, recortada

Fuera «ofertas de la semana» y «testimonios». No es que estuvieran mal: es que
son las secciones de la otra tienda, y una plantilla que las hereda todas no es
una plantilla distinta sino la misma con otro color. Lo que queda es lo que el
diseno pide y nada mas: portada, los cuatro motivos, el escaparate y las
categorias.
"""
from django.db import migrations


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


def booleano(titulo, defecto=False):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


#: Lo que gana cada bloque. Se anade sin pisar lo que ya hubiera: si alguien
#: retoco un esquema desde el panel de Crynex, su trabajo manda.
PROPS_NUEVAS = {
    "cabecera": {
        "categorias_texto": texto("Boton de categorias (vacio = sin boton)"),
        "categorias_href": texto("Destino del boton", "/tienda"),
        "mostrar_total": booleano("Ensenar el importe en el carrito", False),
    },
    "portada": {
        "kicker_icono": texto("Icono del antetitulo", "hoja"),
        "cta_icono": texto("Dibujo del boton principal (carrito o flecha)", "carrito"),
    },
    "productos-destacados": {
        "centrado": booleano("Encabezado centrado", False),
    },
}

MENU = [
    {"texto": "Inicio", "href": "/", "exacto": True},
    {"texto": "Tienda", "href": "/tienda", "exacto": False},
    {"texto": "Nosotros", "href": "/nosotros", "exacto": False},
    {"texto": "Contacto", "href": "/contacto", "exacto": False},
]

AVISOS = [
    {"texto": "Envíos rápidos a todo el país", "icono": "camion", "lado": "izquierda"},
    {"texto": "Productos 100% originales", "icono": "escudo", "lado": "izquierda"},
    {"texto": "Atención personalizada", "icono": "soporte", "lado": "derecha"},
    {"texto": "Mi cuenta", "icono": "usuario", "lado": "derecha"},
]

CATEGORIAS = [
    {"texto": "Cuidado facial", "href": "/tienda", "icono": "gotas"},
    {"texto": "Maquillaje", "href": "/tienda", "icono": "pincel"},
    {"texto": "Cuidado capilar", "href": "/tienda", "icono": "tijeras"},
    {"texto": "Cuidado corporal", "href": "/tienda", "icono": "bano"},
    {"texto": "Fragancias", "href": "/tienda", "icono": "perfume"},
    {"texto": "Accesorios", "href": "/tienda", "icono": "joya"},
    {"texto": "Marcas", "href": "/tienda", "icono": "etiqueta"},
]

ARMAZON = [
    {
        "tipo": "cabecera",
        "variante": "boutique",
        "props": {
            # Sin enlaces de texto: en esta cabecera la navegacion vive en la
            # franja de categorias, y repetirla arriba deja dos menus
            # discutiendo cual es el principal.
            "enlaces": [],
            "mostrar_buscador": True,
            "cta_texto": "Mi carrito",
            "mostrar_total": True,
            "categorias_texto": "Categorías",
            "categorias_href": "/tienda",
            "avisos": AVISOS,
        },
    },
    {
        "tipo": "barra-categorias",
        "variante": "franja",
        "props": {
            "enlaces": CATEGORIAS,
            "destacado": {"texto": "Promociones", "href": "/tienda", "icono": "descuento"},
        },
    },
    {
        "tipo": "pie",
        "variante": "",
        "props": {
            "mostrar_cta": True,
            "cta_titulo": "¿Lista para cuidarte mejor?",
            "cta_texto": "Descubre los productos que se adaptan a tu piel y a tu rutina.",
            "cta_boton": "Ver la tienda",
            "cta_href": "/tienda",
            "lema": "Productos de belleza seleccionados para realzar tu belleza natural.",
            "ayuda_titulo": "¿Necesitas ayuda para elegir?",
            "ayuda_texto": "Escríbenos y te recomendamos lo que mejor va contigo.",
            "compra_titulo": "Compra",
            "mostrar_categorias": True,
            "max_categorias": 6,
            "navegacion_titulo": "La tienda",
            "enlaces": MENU,
            "mostrar_redes": True,
        },
    },
]

PORTADA = {
    "kicker": "Tu belleza, nuestra pasión",
    "kicker_icono": "chispa",
    "titulo": "Descubre tu",
    "titulo_resaltado": "mejor versión",
    "texto": (
        "Productos de belleza seleccionados para realzar tu belleza natural "
        "todos los días."
    ),
    "cta_texto": "Comprar ahora",
    "cta_icono": "flecha",
    "cta_href": "/tienda",
    "cta2_texto": "Ver categorías",
    "cta2_href": "/tienda",
    "imagen": "",
    "imagen_alt": "Crema, sérum y perfume sobre una base de piedra con flores",
    "tarjeta_titulo": "",
    "tarjeta_texto": "",
    "tarjeta_icono": "flor",
    "ventajas": [
        {"titulo": "Envíos rápidos", "texto": "A todo el país", "icono": "camion"},
        {"titulo": "Productos originales", "texto": "Garantía de calidad", "icono": "escudo"},
        {"titulo": "Compra segura", "texto": "Tus datos protegidos", "icono": "candado"},
    ],
}

VALORES = {
    "titulo": "",
    "publicos": [
        {
            "titulo": "Marcas confiables",
            "texto": "Trabajamos con las mejores marcas del mundo.",
            "icono": "joya",
        },
        {
            "titulo": "Ingredientes de calidad",
            "texto": "Fórmulas seguras que cuidan tu piel y tu cabello.",
            "icono": "hoja",
        },
        {
            "titulo": "Para cada tipo de belleza",
            "texto": "Productos para cada necesidad y estilo.",
            "icono": "corazon",
        },
        {
            "titulo": "Belleza consciente",
            "texto": "No testamos en animales y cuidamos del planeta.",
            "icono": "conejo",
        },
    ],
}

HOME = [
    {"tipo": "portada", "variante": "boutique", "props": PORTADA},
    {"tipo": "publicos-objetivo", "variante": "tarjetas", "props": VALORES},
    {
        "tipo": "productos-destacados",
        "variante": "rejilla",
        "props": {
            "kicker": "",
            "titulo": "Lo más amado",
            "subtitulo": "Los favoritos de nuestras clientas",
            "centrado": True,
        },
    },
    {"tipo": "categorias-destacadas", "variante": "rejilla", "props": {}},
]


def normalizar(bruto, indice):
    return {
        "id": f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def componer(lista):
    return [normalizar(b, i) for i, b in enumerate(lista)]


def sembrar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")

    for codigo, nuevas in PROPS_NUEVAS.items():
        bloque = Bloque.objects.filter(codigo=codigo).first()
        if bloque is None:
            continue
        esquema = dict(bloque.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        for clave, campo in nuevas.items():
            propiedades.setdefault(clave, campo)
        esquema["properties"] = propiedades
        esquema.setdefault("tipo", "object")
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])

    plantilla = Plantilla.objects.filter(slug="belleza").first()
    if plantilla is None:
        return

    # Se reescriben las dos paginas del diseno y se deja `/entrar` como estaba:
    # la pantalla de acceso no cambio, y regenerarla borraria lo que alguien
    # hubiera retocado desde el panel.
    paginas = dict(plantilla.paginas or {})
    paginas["/_layout"] = componer(ARMAZON)
    paginas["/"] = componer(HOME)
    plantilla.paginas = paginas
    plantilla.save(update_fields=["paginas"])


def retirar(apps, schema_editor):
    # No se deshace la composicion: volver a la anterior seria devolver la
    # plantilla a un estado que se corrigio a proposito. Las propiedades nuevas
    # se quedan en el esquema; sobran sin molestar, y quitarlas dejaria
    # composiciones nombrando campos que el editor ya no sabria pintar.
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0018_fuente_de_titulos")]

    operations = [migrations.RunPython(sembrar, retirar)]
