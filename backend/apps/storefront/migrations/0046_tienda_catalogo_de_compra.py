"""
"/tienda" deja de ser una landing y pasa a ser el catálogo de compra.

# El encargo

El Inicio ya es la pieza de marca y publicidad (`0045`). "/tienda" tiene otra
misión: convertir la intención de compra en un pedido. La composición queda en
el orden que esa misión pide —encabezado con buscador, categorías,
favoritos, barra del catálogo, rejilla— y todo lo que no ayuda a encontrar,
elegir o agregar un producto sale de esta página:

    antes (publicada)                    después
    ─────────────────────────────────    ────────────────────────────────────
    catalogo-hero  "Frescura que mueve"  catalogo-hero   "Todo para abastecer
                   + botón "Explorar"                     tu negocio." + buscador
    producto-destacado                   repetir-pedido  (solo si hay un pedido
    separador ×4   (apilados)                             anterior en este equipo)
    categorias-navegacion                categorias-navegacion  (fichas visuales)
    catalogo-toolbar                     favoritos-negocios  (protagonista + lista)
    grid-productos "Todos los productos" catalogo-toolbar  "Todos los productos"
    separador ×2                         grid-productos  (panel de filtros, carga
                                                          progresiva, cierre)

* `producto-destacado` se sustituye por `favoritos-negocios`: el mismo dato
  (`/orders/productos-mas-vendidos/`), pero con un protagonista y "También
  puedes pedir…" en vez de un solo producto, y con la etiqueta "El más
  pedido" condicionada a que el producto salga del ranking real.
* Los seis `separador` eran ornamento, cuatro de ellos seguidos: no ayudan a
  descubrir, elegir ni comprar nada.
* `repetir-pedido` ya existía y no pinta nada si el cliente no tiene un
  pedido anterior guardado; para quien sí, es la compra más rápida posible.
* La imagen del encabezado pasa del PNG de 490 KB de la biblioteca al WebP
  de 183 KB que ya está en `/img/home/abastecimiento.webp` — es la misma
  composición.

Los bloques del catálogo (`catalogo-hero`, `categorias-navegacion`,
`catalogo-toolbar`, `grid-productos`) conservan su id y su tipo; solo cambian
sus textos. Se registran en el catálogo las propiedades nuevas que el panel
necesita para editarlos.

# Reversible

Mismo criterio que `0028`/`0030`/`0044`: la composición anterior queda
ARCHIVADA, no borrada — "Restaurar versión" en el panel la devuelve. Se
actualiza también la plantilla "la-gran-cosecha", para que una tienda nueva
que la adopte nazca con el catálogo nuevo.
"""
import copy

from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"


def texto(titulo, defecto=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    return campo


def booleano(titulo, defecto):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


def numero(titulo, defecto):
    return {"tipo": "number", "titulo": titulo, "default": defecto}


BLOQUE_FAVORITOS = {
    "codigo": "favoritos-negocios",
    "nombre": "Favoritos de los negocios",
    "categoria": "CATALOGO",
    "descripcion": (
        "Merchandising del catálogo: un producto protagonista con compra directa "
        "y una lista corta de «También puedes pedir…». Se oculta mientras hay un "
        "filtro o una búsqueda activa."
    ),
    "icono": "flame",
    "esquema_props": {
        "tipo": "object",
        "properties": {
            "kicker": texto("Antetítulo", "Para empezar tu pedido"),
            "titulo": texto("Título", "Los favoritos de los negocios"),
            "subtitulo": texto("Subtítulo"),
            "kicker_principal": texto("Etiqueta del protagonista (con ventas)", "El más pedido"),
            "kicker_sin_historial": texto(
                "Etiqueta del protagonista (sin historial de ventas)", "Destacado del catálogo"
            ),
            "titulo_secundarios": texto("Título de la lista", "También puedes pedir…"),
            "secundarios": numero("Productos en la lista", 4),
        },
    },
    "variantes": [],
    "requiere_datos": True,
    "unico_por_pagina": True,
    "a_sangre": False,
    "orden": 33,
}

# Propiedades nuevas de bloques que ya existen. Se AÑADEN al esquema actual;
# no se reescribe lo que el esquema ya tenía.
PROPS_NUEVAS = {
    "catalogo-hero": {
        "mostrar_buscador": booleano("Mostrar el buscador", True),
        "buscador_etiqueta": texto("Pregunta sobre el buscador", "¿Qué estás buscando?"),
        "buscador_placeholder": texto("Texto de ejemplo del buscador", "Buscar productos…"),
    },
    "categorias-navegacion": {
        "titulo": texto("Título sobre las categorías"),
    },
    "catalogo-toolbar": {
        "titulo": texto("Título del catálogo", "Todos los productos"),
        "mostrar_buscador": booleano("Buscador en la barra", False),
    },
    "grid-productos": {
        "mostrar_filtros": booleano("Panel de filtros (catálogo)", True),
    },
}

HERO = {
    "kicker": "Catálogo de abastecimiento",
    "titulo": "Todo para abastecer",
    "titulo_resaltado": "tu negocio.",
    "texto": "Frutas, verduras, tubérculos, granos y más. Elige, agrega y arma tu pedido en minutos.",
    "imagen": "/img/home/abastecimiento.webp",
    "cta_texto": "",
    "cta_href": "#catalogo",
    "mostrar_estadisticas": True,
    "mostrar_buscador": True,
    "buscador_etiqueta": "¿Qué estás buscando?",
    "buscador_placeholder": "Buscar mango, tomate, papa, banano…",
}

TOOLBAR = {"titulo": "Todos los productos"}

GRID = {
    "id": "catalogo",
    "kicker": "",
    "titulo": "",
    "subtitulo": "",
    "tarjeta_variante": "estandar",
    "mostrar_filtros": True,
}

# El orden final de la página. Los que ya existen conservan id, variante y
# visibilidad; los que faltan se crean con estos valores.
ORDEN = [
    ("catalogo-hero", "compacto", HERO),
    ("repetir-pedido", "", {}),
    ("categorias-navegacion", "pills", {"todos_texto": "Todos"}),
    ("favoritos-negocios", "", {}),
    ("catalogo-toolbar", "completa", TOOLBAR),
    ("grid-productos", "rejilla", GRID),
]


def _bloque(tipo, variante, props, indice):
    return {
        "id": f"{tipo}-{indice}",
        "tipo": tipo,
        "variante": variante,
        "props": copy.deepcopy(props),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def _componer(anterior):
    """La composición nueva, reutilizando lo que la anterior ya tenía."""
    if any(b.get("tipo") == "favoritos-negocios" for b in anterior):
        return anterior, False  # ya se aplicó; no duplicar en un re-run.

    existentes = {}
    for b in anterior:
        existentes.setdefault(b.get("tipo"), b)

    nueva = []
    for indice, (tipo, variante, props) in enumerate(ORDEN):
        previo = existentes.get(tipo)
        if previo is None:
            nueva.append(_bloque(tipo, variante, props, indice))
            continue
        bloque = copy.deepcopy(previo)
        bloque["variante"] = bloque.get("variante") or variante
        bloque["props"] = {**(bloque.get("props") or {}), **copy.deepcopy(props)}
        nueva.append(bloque)
    return nueva, True


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 0. El catálogo de bloques.
    Bloque.objects.get_or_create(codigo=BLOQUE_FAVORITOS["codigo"], defaults=BLOQUE_FAVORITOS)
    for codigo, nuevas in PROPS_NUEVAS.items():
        bloque = Bloque.objects.filter(codigo=codigo).first()
        if bloque is None:
            continue
        esquema = copy.deepcopy(bloque.esquema_props or {"tipo": "object", "properties": {}})
        propiedades = esquema.setdefault("properties", {})
        cambiado = False
        for nombre, definicion in nuevas.items():
            if nombre not in propiedades:
                propiedades[nombre] = definicion
                cambiado = True
        if cambiado:
            bloque.esquema_props = esquema
            bloque.save(update_fields=["esquema_props"])

    # 1. El molde.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        tienda = paginas.get("/tienda")
        if tienda:
            nueva, cambiado = _componer(tienda)
            if cambiado:
                paginas["/tienda"] = nueva
                plantilla.paginas = paginas
                plantilla.save(update_fields=["paginas"])

    # 2. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta="/tienda").first()
    if pagina is None:
        return
    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    nueva_composicion, cambiado = _componer(list(publicada.composicion or []))
    if not cambiado:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])

    ultimo_numero = (
        pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    )
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva_composicion,
        nota=(
            "Catálogo de compra: encabezado con buscador, categorías visuales, "
            "favoritos de los negocios, filtros y rejilla. Sin separadores ni "
            "secciones de marca."
        ),
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()

    # El título del buscador del navegador también dice qué es esta página.
    if not pagina.seo_descripcion or "Frescura" in (pagina.seo_descripcion or ""):
        pagina.seo_descripcion = (
            "Catálogo de frutas, verduras, tubérculos, granos y más para abastecer "
            "tu negocio. Busca, elige la unidad y arma tu pedido en minutos."
        )
        pagina.save(update_fields=["seo_descripcion"])


def revertir(apps, schema_editor):
    # Mismo criterio que 0028/0030/0044: no se deshace contenido publicado en
    # automático. Volver atrás de verdad es "Restaurar versión" en el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0045_home_campanas_publicitarias"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
