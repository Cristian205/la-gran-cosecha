"""
El catálogo, como bloques del motor — y no una página aparte.

Hasta hoy `/tienda` era la única ruta de contenido ajena al motor: una página
de Next escrita a mano, que nunca pasaba por `Lienzo`/`registro.tsx`/`Bloque`.
`Pagina.Tipo.CATALOGO` existía desde el principio y no lo usaba nadie. Esta
migración dobla la apuesta que ya hizo `0023_biblioteca_de_bloques`: dar de
alta piezas GENÉRICAS y reutilizables por cualquier negocio, y usarlas para
componer, como primer caso de uso real, la tienda de La Gran Cosecha.

# Los bloques nuevos

    catalogo-hero          el hero reducido del catálogo: una franja, no una
                            pantalla completa — quien llega aquí ya decidió
                            comprar.
    categorias-navegacion  el filtro de categorías EN VIVO. Distinto de
                            `categorias-destacadas` (un destino, enlaza al
                            catálogo filtrado) y de `barra-categorias`
                            (atajos editoriales fijos del armazón): este lee
                            las categorías reales y, coordinado por
                            `CatalogoProvider` (frontend), filtra sin navegar.
    catalogo-toolbar       cuántos productos hay, buscarlos, ordenarlos. Sin
                            filtro de precio ni de disponibilidad a propósito:
                            el catálogo del backend (`ProductoFilter`) todavía
                            no los admite, y una UI que no filtra nada
                            prometería algo falso.

`grid-productos` (ya existente) gana la variante `lista` — filas apiladas,
para cuando `tarjeta_variante="compacta"` arma una sección de compra rápida—
y el campo `tarjeta_variante` en su `esquema_props`. No es un bloque nuevo:
sigue siendo la misma rejilla genérica, coordinada por el mismo
`CatalogoProvider` cuando hay uno alrededor, y sin cambios para quien ya la
usa suelta (el Inicio, hoy).

# Por qué esto no toca ninguna otra tienda

Los tres bloques son nuevos: ninguna composición existente puede estar
usándolos. La variante `lista` de `grid-productos` es opt-in, igual que
`categorias-destacadas: tarjetas` en `0024`. Y la única `Pagina`/`VersionPagina`
que esta migración escribe es la de "/tienda" del tenant real "La Gran
Cosecha" (mismo identificado que usa `tenancy.0002_migra_la_gran_cosecha`) —
ningún otro negocio se lee ni se escribe.
"""
from django.db import migrations
from django.utils import timezone


# --------------------------------------------------------------------------
# Los mismos ayudantes de 0023 — copiados y no importados: una migración que
# importa de otra hace lo que aquella diga DENTRO DE UN AÑO, no lo que decía
# el día que se escribió.
# --------------------------------------------------------------------------
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def bandera(titulo, defecto=False, ayuda=""):
    campo = {"tipo": "boolean", "titulo": titulo, "default": defecto}
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


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


def encabezado(kicker="", titulo="", subtitulo=""):
    return {
        "kicker": texto("Antetitulo", kicker),
        "titulo": texto("Titulo", titulo),
        "subtitulo": texto("Texto a la derecha", subtitulo),
        "centrado": bandera("Encabezado centrado", False),
    }


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

# --------------------------------------------------------------------------
# 1. Los tres bloques nuevos
# --------------------------------------------------------------------------
NUEVOS = {
    "catalogo-hero": {
        "nombre": "Hero del catálogo",
        "descripcion": "La franja de arriba de una página de catálogo. Reducida a propósito: quien llega ya decidió comprar.",
        "categoria": "CATALOGO",
        "icono": "layout-panel-top",
        "esquema_props": objeto(
            kicker=texto("Antetitulo"),
            kicker_icono=texto("Icono del antetitulo", "canasta"),
            titulo=texto("Titulo"),
            titulo_resaltado=texto("Titulo (parte resaltada)"),
            texto=texto("Texto"),
            imagen=texto("Imagen de fondo (URL)", ayuda="Vacío = solo el degradado de marca."),
            cta_texto=texto("Texto del boton"),
            cta_href=texto("Enlace del boton", "#catalogo"),
            mostrar_estadisticas=bandera(
                "Mostrar cuántos productos y categorías hay",
                True,
                ayuda="Se calcula en vivo; solo aparece si el bloque está dentro de una página de catálogo.",
            ),
        ),
        "variantes": [{"codigo": "compacto", "nombre": "Compacto"}],
        "tokens_admitidos": BASE,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "orden": 30,
    },
    "categorias-navegacion": {
        "nombre": "Categorías (filtro en vivo)",
        "descripcion": "Elegir una categoría filtra el catálogo en la misma pantalla, sin navegar. Distinto de «Categorías destacadas», que enlaza a otra vista.",
        "categoria": "CATALOGO",
        "icono": "list-filter",
        "esquema_props": objeto(
            todos_texto=texto("Texto de \"ver todos\"", "Todos"),
        ),
        "variantes": [{"codigo": "pills", "nombre": "Píldoras"}],
        "tokens_admitidos": BASE,
        "unico_por_pagina": True,
        "a_sangre": False,
        "requiere_datos": False,
        "orden": 32,
    },
    "catalogo-toolbar": {
        "nombre": "Barra del catálogo",
        "descripcion": "Cuántos productos hay, buscarlos y ordenarlos. Solo funciona dentro de una página de catálogo.",
        "categoria": "CATALOGO",
        "icono": "sliders-horizontal",
        "esquema_props": objeto(),
        "variantes": [{"codigo": "completa", "nombre": "Completa"}],
        "tokens_admitidos": BASE,
        "unico_por_pagina": True,
        "a_sangre": False,
        "requiere_datos": False,
        "orden": 34,
    },
}

# --------------------------------------------------------------------------
# 2. `grid-productos`: variante `lista` + el campo `tarjeta_variante`
# --------------------------------------------------------------------------
GRID_PRODUCTOS_VARIANTES = [
    {"codigo": "rejilla", "nombre": "Rejilla"},
    {"codigo": "carrusel", "nombre": "Carrusel horizontal"},
    {"codigo": "lista", "nombre": "Lista (filas)"},
]

GRID_PRODUCTOS_ESQUEMA = objeto(
    **encabezado(),
    categoria_id=numero(
        "Categoria",
        minimo=1,
        ayuda="Vacio = todo el catalogo. El id sale de Catalogo > Categorias. Se ignora dentro de una página de catálogo interactivo.",
    ),
    limite=numero("Cuantos mostrar", 8, minimo=1, maximo=24),
    orden={
        "tipo": "enum",
        "titulo": "Orden",
        "opciones": ["recientes", "precio_asc", "precio_desc", "nombre"],
        "default": "recientes",
    },
    tarjeta_variante={
        "tipo": "enum",
        "titulo": "Estilo de cada tarjeta",
        "opciones": ["estandar", "compacta"],
        "default": "estandar",
        "ayuda": "«Compacta» arma una fila densa — es lo que usa Compra rápida.",
    },
)

GRID_PRODUCTOS_TOKENS = BASE + [
    "columnas-catalogo",
    "columnas-catalogo-tablet",
    "columnas-catalogo-movil",
    "estilo-tarjeta",
    "densidad-escala",
]

# --------------------------------------------------------------------------
# 3. Los dos tokens de columnas que faltaban (tablet y móvil)
# --------------------------------------------------------------------------
TOKENS_NUEVOS = [
    {
        "codigo": "columnas-catalogo-tablet",
        "nombre": "Productos por fila (tablet)",
        "descripcion": "En pantallas medianas. Antes era un número fijo para todas las tiendas.",
        "grupo": "DENSIDAD",
        "tipo": "OPCION",
        "variable_css": "--columnas-catalogo-tablet",
        "valor_por_defecto": "3",
        "unidad": "",
        "orden": 21,
        "opciones": [
            {"valor": "2", "nombre": "Dos"},
            {"valor": "3", "nombre": "Tres"},
            {"valor": "4", "nombre": "Cuatro"},
        ],
    },
    {
        "codigo": "columnas-catalogo-movil",
        "nombre": "Productos por fila (móvil)",
        "descripcion": "En el teléfono. Antes era un número fijo para todas las tiendas.",
        "grupo": "DENSIDAD",
        "tipo": "OPCION",
        "variable_css": "--columnas-catalogo-movil",
        "valor_por_defecto": "2",
        "unidad": "",
        "orden": 22,
        "opciones": [
            {"valor": "1", "nombre": "Una — catálogo en lista"},
            {"valor": "2", "nombre": "Dos"},
        ],
    },
]

# --------------------------------------------------------------------------
# 4. La composición de "/tienda" para La Gran Cosecha
# --------------------------------------------------------------------------
CATALOGO_HERO_PROPS = {
    "kicker": "Catalogo completo",
    "kicker_icono": "canasta",
    "titulo": "Todo lo que necesitas",
    "titulo_resaltado": "para tu negocio.",
    "texto": "Productos frescos, distintas presentaciones y pedidos faciles desde un solo lugar.",
    "cta_texto": "Explorar productos",
    "cta_href": "#catalogo",
    "mostrar_estadisticas": True,
}

HOME_TIENDA_COSECHA = [
    {"tipo": "catalogo-hero", "variante": "compacto", "props": CATALOGO_HERO_PROPS},
    {"tipo": "categorias-navegacion", "variante": "pills", "props": {"todos_texto": "Todos"}},
    {"tipo": "catalogo-toolbar", "variante": "completa", "props": {}},
    {
        "tipo": "grid-productos",
        "variante": "rejilla",
        "props": {"tarjeta_variante": "estandar"},
    },
]

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"


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


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    TokenTema = apps.get_model("storefront", "TokenTema")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 1. Los bloques nuevos.
    for codigo, datos in NUEVOS.items():
        Bloque.objects.update_or_create(codigo=codigo, defaults=datos)

    # 2. `grid-productos`: variante y esquema nuevos, solo lo que falte.
    grid = Bloque.objects.filter(codigo="grid-productos").first()
    if grid is not None:
        codigos = {v.get("codigo") for v in (grid.variantes or [])}
        faltan = [v for v in GRID_PRODUCTOS_VARIANTES if v["codigo"] not in codigos]
        if faltan:
            grid.variantes = [*(grid.variantes or []), *faltan]
        grid.esquema_props = GRID_PRODUCTOS_ESQUEMA
        grid.tokens_admitidos = sorted(set((grid.tokens_admitidos or []) + GRID_PRODUCTOS_TOKENS))
        grid.save(update_fields=["variantes", "esquema_props", "tokens_admitidos"])

    # 3. Los dos tokens de columnas que faltaban.
    for datos in TOKENS_NUEVOS:
        TokenTema.objects.get_or_create(
            codigo=datos["codigo"], defaults={k: v for k, v in datos.items() if k != "codigo"}
        )

    composicion = componer(HOME_TIENDA_COSECHA)

    # 4. El molde: para que una tienda nueva que adopte "la-gran-cosecha"
    #    nazca con su catálogo ya compuesto. No afecta a ningún negocio que
    #    ya la haya adoptado — adoptar_plantilla COPIA, nunca referencia.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas[RUTA] = composicion
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    # 5. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina, _ = Pagina.objects.get_or_create(
        tenant=tenant,
        ruta=RUTA,
        defaults={"titulo": "Catálogo", "tipo": "CATALOGO"},
    )
    if pagina.tipo != "CATALOGO":
        pagina.tipo = "CATALOGO"
        pagina.save(update_fields=["tipo"])

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is not None:
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
        composicion=composicion,
        nota="El catálogo pasa a componerse con bloques del motor.",
        fecha_publicacion=timezone.now(),
    )

    # El borrador que hubiera a medias en el panel se descarta: seguir
    # editando sobre una composición que ya no es la publicada confundiría a
    # quien entre al editor después de este cambio.
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    """
    No se intenta reconstruir la página de catálogo anterior — mismo criterio
    que ya documentó `0024_home_gran_cosecha_rediseno`: revertir en automático
    sobrescribiría en silencio cualquier ajuste hecho desde el panel después
    de publicar esto. Volver atrás de verdad se hace restaurando una versión
    archivada desde el panel, donde sigue disponible.

    Solo se deshace la parte de catálogo de bloques: los tres nuevos se
    desactivan (se archivan, no se borran — una composición que ya los usa no
    puede quedarse sin poder validar) y la variante `lista` se retira de
    `grid-productos` si nadie la puso.
    """
    Bloque = apps.get_model("storefront", "Bloque")

    Bloque.objects.filter(codigo__in=list(NUEVOS)).update(activo=False)

    grid = Bloque.objects.filter(codigo="grid-productos").first()
    if grid is not None:
        grid.variantes = [v for v in (grid.variantes or []) if v.get("codigo") != "lista"]
        grid.save(update_fields=["variantes"])


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0024_home_gran_cosecha_rediseno"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
