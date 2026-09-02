"""
Dos bloques nuevos, una variante, y la plantilla de La Gran Cosecha.

Es la primera vez que se compone una tienda ENTERA desde el motor, y sirve de
prueba de que el reparto entre codigo y datos esta bien puesto: de la portada
del diseno, todo lo que cambia entre un negocio y otro —el titular, la foto,
los cuatro publicos, los cuatro pasos— entra como propiedades. Lo unico que
hubo que escribir en codigo son dos componentes y unas reglas de estilo.

# Que falta y que no

De las cinco piezas del diseno, tres YA existian:

    los pasos          `como-funciona`, con una variante nueva
    la franja final    `insignias-confianza`, que ya lee TrustBadge
    la navegacion      no es un bloque: es el armazon de la tienda

Y dos no:

    portada            un titular fijo con foto. Distinto del carrusel de
                       promociones, que rota banderolas cargadas por el negocio:
                       aquel ENSENA lo que hay, esta PROMETE algo. Un negocio
                       elige uno de los dos, y por eso los dos son unicos.
    publicos-objetivo  a quien sirve el negocio. Es lo que hace que quien llega
                       se reconozca antes de mirar un precio.

# Por que la variante y no un tercer bloque

Los pasos del diseno van en fila, numerados y unidos por un hilo; los de la
tienda actual van en tarjetas. Mismos datos exactos, otro dibujo: eso es una
VARIANTE. Un bloque aparte habria duplicado el esquema de propiedades y dejado
dos que mantener, que es justo lo que el motor existe para evitar.
"""
from django.db import migrations


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


BLOQUES = [
    {
        "codigo": "portada",
        "nombre": "Portada",
        "categoria": "ESTRUCTURA",
        "descripcion": "El titular de la tienda, con foto y llamadas a la accion.",
        "icono": "layout-panel-top",
        "orden": 5,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "imagen", "nombre": "Con foto al lado"},
            {"codigo": "centrado", "nombre": "Centrado, sin foto"},
        ],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "kicker": texto("Antetitulo"),
                "titulo": texto("Titular"),
                "titulo_resaltado": texto("Titular resaltado"),
                "texto": texto("Texto"),
                "cta_texto": texto("Boton principal", "Hacer mi pedido"),
                "cta_href": texto("Enlace del boton principal", "/tienda"),
                "cta2_texto": texto("Boton secundario", "Ver productos"),
                "cta2_href": texto("Enlace del boton secundario", "/tienda"),
                "imagen": texto("Foto (URL)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "tarjeta_titulo": texto("Tarjeta flotante: titulo"),
                "tarjeta_texto": texto("Tarjeta flotante: texto"),
                "tarjeta_icono": texto("Tarjeta flotante: icono", "reloj"),
                "ventajas": {
                    "tipo": "array",
                    "titulo": "Ventajas",
                    "items": {
                        "tipo": "object",
                        "properties": {
                            "titulo": texto("Texto"),
                            "icono": texto("Icono", "hoja"),
                        },
                    },
                },
            },
        },
    },
    {
        "codigo": "publicos-objetivo",
        "nombre": "Para quien es",
        "categoria": "CONTENIDO",
        "descripcion": "A que tipo de negocios sirve. Franja oscura, alta en la pagina.",
        "icono": "users-round",
        "orden": 15,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "titulo": texto("Titulo"),
                "publicos": {
                    "tipo": "array",
                    "titulo": "Publicos",
                    "items": {
                        "tipo": "object",
                        "properties": {
                            "titulo": texto("Titulo"),
                            "texto": texto("Texto"),
                            "icono": texto("Icono", "tienda"),
                        },
                    },
                },
            },
        },
    },
]

#: La variante nueva de `como-funciona`. Se anaden a las que ya tenia en vez de
#: reemplazarlas: una tienda que hoy usa la de tarjetas no puede quedarse sin
#: maquetar porque aqui se reescribiera la lista.
VARIANTES_COMO_FUNCIONA = [
    {"codigo": "tarjetas", "nombre": "Tarjetas"},
    {"codigo": "linea", "nombre": "En fila, numerados"},
]


# ==========================================================================
# LA PLANTILLA
# ==========================================================================
PORTADA = {
    "kicker": "Abastecemos tu negocio",
    "titulo": "Todo lo que tu negocio necesita,",
    "titulo_resaltado": "en un solo pedido.",
    "texto": (
        "Frutas, verduras, tuberculos y mas productos frescos, seleccionados "
        "en abastos y entregados directamente en tu negocio."
    ),
    "cta_texto": "Hacer mi pedido",
    "cta_href": "/tienda",
    "cta2_texto": "Ver productos",
    "cta2_href": "/tienda",
    "imagen": "",
    "imagen_alt": "Cajon de frutas y verduras frescas junto al camion de reparto",
    "tarjeta_titulo": "Del abasto a tu negocio",
    "tarjeta_texto": "Fresco, rapido y confiable.",
    "tarjeta_icono": "reloj",
    "ventajas": [
        {"titulo": "Productos frescos", "icono": "hoja"},
        {"titulo": "Calidad garantizada", "icono": "escudo"},
        {"titulo": "Entregas puntuales", "icono": "camion"},
        {"titulo": "Atencion personalizada", "icono": "soporte"},
    ],
}

PUBLICOS = {
    "titulo": "Disenado para negocios que necesitan abastecerse",
    "publicos": [
        {
            "titulo": "Restaurantes",
            "texto": "Abastece tu cocina con productos frescos sin salir de tu negocio.",
            "icono": "restaurante",
        },
        {
            "titulo": "Fruterias y tiendas",
            "texto": "Encuentra frutas y productos de calidad para tu negocio todos los dias.",
            "icono": "canasta",
        },
        {
            "titulo": "Comercios y cafeterias",
            "texto": "Haz pedidos faciles y recibe todo lo que necesitas en un solo lugar.",
            "icono": "cafeteria",
        },
        {
            "titulo": "Hoteles y mas negocios",
            "texto": "Soluciones de abastecimiento confiables para tu operacion diaria.",
            "icono": "edificio",
        },
    ],
}

PASOS = {
    "kicker": "",
    "titulo": "Asi de facil funciona",
    "subtitulo": "",
    "pasos": [
        {
            "titulo": "Haz tu pedido",
            "texto": "Selecciona los productos y cantidades que tu negocio necesita.",
            "icono": "canasta",
        },
        {
            "titulo": "Consolidamos tu solicitud",
            "texto": "Recibimos tu pedido y lo preparamos para abastecerlo.",
            "icono": "lista",
        },
        {
            "titulo": "Compramos y seleccionamos",
            "texto": "Vamos al abasto, elegimos lo mejor y preparamos tu pedido.",
            "icono": "caja",
        },
        {
            "titulo": "Entregamos en tu negocio",
            "texto": "Recibe tu pedido fresco, completo y a tiempo.",
            "icono": "camion",
        },
    ],
}

#: La composicion del diseno, de arriba abajo. Las insignias del final leen sus
#: filas de `TrustBadge`, asi que aqui solo se coloca la franja: que diga
#: «Productos frescos» o «Compras inteligentes» es contenido del negocio.
HOME = [
    {"tipo": "portada", "variante": "imagen", "props": PORTADA},
    {"tipo": "publicos-objetivo", "variante": "", "props": PUBLICOS},
    {"tipo": "como-funciona", "variante": "linea", "props": PASOS},
    {"tipo": "insignias-confianza", "variante": "franja", "props": {}},
    {"tipo": "categorias-destacadas", "variante": "rejilla", "props": {}},
    {"tipo": "productos-destacados", "variante": "rejilla", "props": {}},
    {"tipo": "testimonios", "variante": "", "props": {}},
    {"tipo": "cta-banda", "variante": "", "props": {
        "titulo": "Empieza a abastecer tu negocio hoy",
        "texto": "Arma tu pedido en minutos y recibelo donde trabajas.",
        "boton_texto": "Hacer mi pedido",
        "boton_href": "/tienda",
    }},
]


def normalizar(bruto, indice):
    """La forma completa que el lienzo espera de cada bloque."""
    return {
        "id": f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def sembrar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")

    for datos in BLOQUES:
        Bloque.objects.get_or_create(
            codigo=datos["codigo"], defaults={k: v for k, v in datos.items() if k != "codigo"}
        )

    paso = Bloque.objects.filter(codigo="como-funciona").first()
    if paso is not None:
        codigos = {v.get("codigo") for v in (paso.variantes or [])}
        # Solo se anade lo que falta: si alguien retoco la lista desde el panel,
        # su trabajo manda.
        faltan = [v for v in VARIANTES_COMO_FUNCIONA if v["codigo"] not in codigos]
        if faltan:
            paso.variantes = [*(paso.variantes or []), *faltan]
            paso.save(update_fields=["variantes"])

    Plantilla.objects.get_or_create(
        slug="la-gran-cosecha",
        defaults={
            "nombre": "La Gran Cosecha",
            "descripcion": (
                "Portada con propuesta y foto, publicos objetivo y los pasos del "
                "servicio. Para distribuidoras que abastecen a otros negocios."
            ),
            "sector": "Alimentos",
            "paginas": {"/": [normalizar(b, i) for i, b in enumerate(HOME)]},
            "activa": True,
            # NO es la predeterminada: «Mercado» lo sigue siendo. Un negocio que
            # se da de alta manana no deberia estrenar una portada pensada para
            # un mayorista concreto.
            "es_predeterminada": False,
            "orden": 5,
        },
    )


def retirar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")

    Plantilla.objects.filter(slug="la-gran-cosecha").delete()
    # Los bloques se desactivan en vez de borrarse: una pagina publicada puede
    # tenerlos colocados, y borrar la fila dejaria esa composicion nombrando
    # algo que ya no existe.
    Bloque.objects.filter(codigo__in=[b["codigo"] for b in BLOQUES]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0006_aspecto_de_plantilla")]

    operations = [migrations.RunPython(sembrar, retirar)]
