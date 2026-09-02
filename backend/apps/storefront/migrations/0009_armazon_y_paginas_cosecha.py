"""
La cabecera y el pie pasan a ser editables, y La Gran Cosecha gana sus paginas.

# Por que el armazon es UNA composicion y no dos bloques por pagina

La tentacion era poner `cabecera` y `pie` al principio y al final de cada
pagina. Con cuatro rutas eso son cuatro copias del menu y cuatro del pie:
cambiar un telefono serian cuatro ediciones, y la cuarta se olvida. Peor aun,
nada obligaria a que las cuatro dijeran lo mismo, asi que la tienda podria tener
dos menus distintos segun donde entrara el visitante.

Asi que el armazon es su propia pagina —ruta `/_layout`, tipo `LAYOUT`— y el
`layout.tsx` de Next la pinta alrededor de todas las demas. Gana lo mismo que
cualquier otra composicion: borrador y publicada, historial, el mismo editor y
la misma visibilidad por dispositivo.

# Por que los bloques reutilizan los componentes que ya existian

`cabecera` es `Navbar` y `pie` es `Footer`, con propiedades anadidas. No se
escribieron componentes nuevos: el buscador movil, el atajo de teclado, el
acordeon del pie y la columna de categorias ya estaban resueltos ahi, y
duplicarlos habria dado dos cabeceras que mantener — con una quedandose atras.

Sin propiedades se comportan exactamente como antes, que es lo que permite dar
el armazon a los negocios que ya existen sin cambiarles nada de lo que ven.

# Lo que NO es propiedad del bloque

El logo, el telefono, el correo, las redes y el horario siguen saliendo de la
configuracion del negocio. Son su identidad, no la maqueta de una pagina:
duplicarlos aqui daria dos sitios donde cambiar el telefono, y el segundo se
quedaria viejo. Lo que si es del bloque son los TEXTOS y que se muestra.
"""
from django.db import migrations


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


def booleano(titulo, defecto=True):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


ENLACES_PROP = {
    "tipo": "array",
    "titulo": "Enlaces",
    "items": {
        "tipo": "object",
        "properties": {
            "texto": texto("Texto"),
            "href": texto("Destino", "/"),
            "exacto": {"tipo": "boolean", "titulo": "Solo la ruta exacta", "default": False},
        },
    },
}

BLOQUES = [
    {
        "codigo": "cabecera",
        "nombre": "Cabecera",
        "categoria": "ESTRUCTURA",
        "descripcion": "El menu, el buscador y el carrito. Va en el armazon, no en cada pagina.",
        "icono": "panel-top",
        "orden": 1,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "enlaces": ENLACES_PROP,
                "mostrar_buscador": booleano("Mostrar el buscador", True),
                "cta_texto": texto("Texto del boton de carrito", "Carrito"),
            },
        },
    },
    {
        "codigo": "pie",
        "nombre": "Pie de pagina",
        "categoria": "ESTRUCTURA",
        "descripcion": "Cierre de la pagina: llamada final, enlaces y contacto.",
        "icono": "panel-bottom",
        "orden": 200,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "mostrar_cta": booleano("Mostrar la llamada final", True),
                "cta_titulo": texto("Llamada: titulo", "¿Listo para hacer tu pedido?"),
                "cta_texto": texto("Llamada: texto"),
                "cta_boton": texto("Llamada: boton", "Explorar productos"),
                "cta_href": texto("Llamada: destino", "/tienda"),
                "lema": texto("Lema bajo el logo"),
                "ayuda_titulo": texto("Ayuda: titulo", "¿Necesitas ayuda?"),
                "ayuda_texto": texto("Ayuda: texto"),
                "compra_titulo": texto("Columna de compra: titulo", "Compra"),
                "mostrar_categorias": booleano("Listar categorias", True),
                "max_categorias": {
                    "tipo": "number",
                    "titulo": "Cuantas categorias",
                    "default": 4,
                    "minimo": 0,
                    "maximo": 10,
                },
                "navegacion_titulo": texto("Columna de navegacion: titulo", "Navegación"),
                "enlaces": ENLACES_PROP,
                "mostrar_redes": booleano("Mostrar redes sociales", True),
                "nota_legal": texto("Nota legal"),
            },
        },
    },
]

#: El menu de siempre. Es lo que `lib/navegacion.ts` tenia escrito en codigo, y
#: pasarlo aqui es justo el punto: un negocio sin pagina «Nosotros» ahora puede
#: quitarla del menu sin que nadie despliegue nada.
MENU = [
    {"texto": "Inicio", "href": "/", "exacto": True},
    {"texto": "Tienda", "href": "/tienda", "exacto": False},
    {"texto": "Nosotros", "href": "/nosotros", "exacto": False},
    {"texto": "Contáctanos", "href": "/contacto", "exacto": False},
]

ARMAZON = [
    {"tipo": "cabecera", "props": {"enlaces": MENU, "mostrar_buscador": True}},
    {"tipo": "pie", "props": {"enlaces": MENU}},
]

# ==========================================================================
# LAS PAGINAS DE LA GRAN COSECHA
# ==========================================================================
MENU_COSECHA = [
    {"texto": "Productos", "href": "/tienda", "exacto": False},
    {"texto": "Cómo funciona", "href": "/nosotros", "exacto": False},
    {"texto": "Para negocios", "href": "/nosotros", "exacto": False},
    {"texto": "Nosotros", "href": "/nosotros", "exacto": False},
    {"texto": "Contacto", "href": "/contacto", "exacto": False},
]

ARMAZON_COSECHA = [
    {
        "tipo": "cabecera",
        "props": {
            "enlaces": MENU_COSECHA,
            "mostrar_buscador": True,
            "cta_texto": "Mi pedido",
        },
    },
    {
        "tipo": "pie",
        "props": {
            "mostrar_cta": True,
            "cta_titulo": "¿Listo para abastecer tu negocio?",
            "cta_texto": "Arma tu pedido en minutos y recibelo donde trabajas.",
            "cta_boton": "Hacer mi pedido",
            "cta_href": "/tienda",
            "lema": "Abastecemos tu negocio con productos frescos, seleccionados en abastos.",
            "ayuda_titulo": "¿Necesitas ayuda con tu pedido?",
            "ayuda_texto": "Escribenos y te acompanamos en todo el proceso.",
            "compra_titulo": "Productos",
            "mostrar_categorias": True,
            "max_categorias": 5,
            "navegacion_titulo": "La empresa",
            "enlaces": MENU_COSECHA,
            "mostrar_redes": True,
        },
    },
]

NOSOTROS = [
    {
        "tipo": "portada",
        "variante": "centrado",
        "props": {
            "kicker": "Quienes somos",
            "titulo": "Compramos en el abasto",
            "titulo_resaltado": "para que tu no tengas que ir.",
            "texto": (
                "Cada madrugada seleccionamos producto fresco y lo llevamos a "
                "restaurantes, fruterias y comercios que no pueden permitirse "
                "perder una manana en la plaza."
            ),
            "cta_texto": "Ver productos",
            "cta_href": "/tienda",
            "cta2_texto": "Hablar con nosotros",
            "cta2_href": "/contacto",
            "ventajas": [
                {"titulo": "Seleccion en origen", "icono": "hoja"},
                {"titulo": "Precio del dia", "icono": "chispa"},
                {"titulo": "Entrega puntual", "icono": "camion"},
            ],
        },
    },
    {"tipo": "por-que-elegirnos", "variante": "", "props": {}},
    {"tipo": "estadisticas", "variante": "", "props": {}},
    {"tipo": "testimonios", "variante": "", "props": {}},
    {
        "tipo": "cta-banda",
        "variante": "",
        "props": {
            "titulo": "Empieza a abastecer tu negocio hoy",
            "texto": "Arma tu pedido en minutos.",
            "boton_texto": "Hacer mi pedido",
            "boton_href": "/tienda",
        },
    },
]

CONTACTO = [
    {
        "tipo": "portada",
        "variante": "centrado",
        "props": {
            "kicker": "Contacto",
            "titulo": "Cuentanos que necesita",
            "titulo_resaltado": "tu negocio.",
            "texto": (
                "Escribenos con tu lista y te confirmamos disponibilidad y "
                "precio del dia. Si es un pedido grande o algo que no esta en "
                "el catalogo, tambien lo conseguimos."
            ),
            "cta_texto": "Ver productos",
            "cta_href": "/tienda",
            "cta2_texto": "",
        },
    },
    {"tipo": "cotizacion-rapida", "variante": "", "props": {}},
    {"tipo": "insignias-confianza", "variante": "franja", "props": {}},
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
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    for datos in BLOQUES:
        Bloque.objects.get_or_create(
            codigo=datos["codigo"],
            defaults={k: v for k, v in datos.items() if k != "codigo"},
        )

    # --- la plantilla de arranque tambien lleva armazon ----------------
    #
    # Sin esto, un negocio dado de alta manana no tendria `/_layout`: la senal
    # que siembra su tienda copia la plantilla predeterminada, y lo que no este
    # ahi no existe. Se veria bien —el layout cae al respaldo— pero su cabecera
    # no seria editable, que es justo lo que se viene a arreglar.
    for plantilla in Plantilla.objects.all():
        paginas = dict(plantilla.paginas or {})
        if "/_layout" not in paginas:
            paginas["/_layout"] = componer(ARMAZON)
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    # --- la plantilla de La Gran Cosecha gana sus paginas --------------
    plantilla = Plantilla.objects.filter(slug="la-gran-cosecha").first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas["/_layout"] = componer(ARMAZON_COSECHA)
        paginas.setdefault("/nosotros", componer(NOSOTROS))
        paginas.setdefault("/contacto", componer(CONTACTO))
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    # --- el armazon de los negocios que ya existen ---------------------
    #
    # Con el menu de siempre y sin tocar nada mas: lo que ven hoy es
    # exactamente lo que veran manana. Lo que cambia es que a partir de ahora
    # pueden editarlo.
    for tenant in Tenant.objects.all():
        pagina, creada = Pagina.objects.get_or_create(
            tenant=tenant,
            ruta="/_layout",
            defaults={"titulo": "Cabecera y pie", "tipo": "LAYOUT"},
        )
        if not creada and pagina.versiones.exists():
            continue

        VersionPagina.objects.create(
            tenant=tenant,
            pagina=pagina,
            numero=1,
            estado="PUBLICADA",
            composicion=componer(ARMAZON),
            nota="El menu y el pie que estaban en codigo.",
        )


def retirar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Pagina = apps.get_model("storefront", "Pagina")

    # Se borran las paginas de armazon: sin ellas el layout vuelve a pintar la
    # cabecera y el pie de siempre, que es el respaldo que nunca se retiro.
    Pagina.objects.filter(tipo="LAYOUT").delete()
    Bloque.objects.filter(codigo__in=[b["codigo"] for b in BLOQUES]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0008_tipo_layout"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(sembrar, retirar)]
