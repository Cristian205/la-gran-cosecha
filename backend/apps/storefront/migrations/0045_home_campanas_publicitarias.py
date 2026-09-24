"""
El Home de La Gran Cosecha pasa de "fila de bloques" a campaña publicitaria.

# Qué cambia

`0028`/`0030` dejaron el Home como una sucesión de secciones de igual peso
(hero ilustrado, video vacío, beneficios, anuncios, públicos, pasos, banner sin
foto, testimonios, CTA): informativo, pero sin recorrido. Esta migración lo
reemplaza por una pieza con narrativa —campo, producto, selección, entrega,
cliente, compra— hecha de nueve bloques nuevos (ver
`frontend/tienda/src/bloques/campanas/`):

    hero-campana          fotografía a pantalla completa, titular enorme
    producto-spotlight    el favorito de los clientes, como publicidad
    video-campana (x2)    espacios de video: "favoritos" e "historia de marca"
    historia-marca        escenario fijo con cuatro capítulos que cambian al bajar
    campana-editorial     campaña de revista: foto, texto, precio en vivo, CTA
    campana-negocios      la pieza para restaurantes, hoteles y comercios
    testimonios-editorial las voces reales de los clientes
    cierre-cta            el cierre, con WhatsApp

Además `campana-destacada` (imagen gigante) queda registrada y lista para
usarse desde el panel aunque este Home no la coloque todavía.

# Qué NO hace

* No inventa nada: las fotos son las que ya existen (las de `/img`, la del
  mango y las de los productos reales); los textos salen de lo que el sitio ya
  dice (Nosotros, "cómo funciona", beneficios); el único número es el tamaño
  real del catálogo, que llega del servidor. Los dos bloques de video van SIN
  archivo: no pintan nada hasta que alguien pegue una URL en el panel.
* No borra ningún bloque del catálogo: `portada`, `publicos-objetivo`,
  `como-funciona`... siguen disponibles para otras páginas o tiendas.

# Reversible

Mismo criterio que `0028`/`0030`: la composición anterior queda ARCHIVADA, no
borrada — "Restaurar versión" en el panel la devuelve.

# El menú

De paso se corrige el menú del armazón: "Para negocios" apuntaba a
`/tienda#para-negocios`, un ancla que ya no existe desde el rediseño de
`/tienda` (`0044`); ahora va a `/#negocios`, la pieza nueva. Se agrega el botón
"Comprar" de la cabecera (solo escritorio).
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

SEO_TITULO_ANTERIOR = "La Gran Cosecha | Abastecimiento de productos frescos para negocios"
SEO_TITULO = "Frutas y verduras frescas para tu mesa y tu negocio"
SEO_DESCRIPCION = (
    "Frutas, verduras, tubérculos y granos frescos, del campo a tu mesa. Compra "
    "en línea o abastece tu restaurante, hotel o negocio desde Soacha, Cundinamarca."
)


# ---------------------------------------------------------------- catálogo
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def lista(titulo, propiedades):
    return {
        "tipo": "array",
        "titulo": titulo,
        "items": {"tipo": "object", "properties": propiedades},
    }


def objeto(propiedades):
    return {"tipo": "object", "properties": propiedades}


ENFOQUE = "Punto de la foto que se mantiene a la vista, ej. «50% 60%» (horizontal y vertical)."

BLOQUES = [
    {
        "codigo": "hero-campana",
        "nombre": "Hero de campaña",
        "categoria": "ESTRUCTURA",
        "descripcion": "Fotografía a pantalla completa con un titular enorme. Admite video opcional.",
        "icono": "clapperboard",
        "orden": 5,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "titulo_resaltado": texto("Titular resaltado (serif cursiva)"),
                "subtitulo": texto("Subtítulo"),
                "imagen": texto("Foto (URL)"),
                "imagen_movil": texto("Foto para móvil (URL, opcional)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "enfoque": texto("Enfoque en escritorio", "50% 60%", ENFOQUE),
                "enfoque_movil": texto("Enfoque en móvil"),
                "video_url": texto("Video de escritorio (MP4, opcional)", ayuda="Se carga después de la foto y solo si el visitante no pidió menos movimiento."),
                "video_movil_url": texto("Video para móvil (MP4 vertical, opcional)", ayuda="En móvil nunca se descarga el de escritorio."),
                "cta_texto": texto("Botón principal", "Comprar ahora"),
                "cta_href": texto("Enlace del botón principal", "/tienda"),
                "cta2_texto": texto("Botón secundario"),
                "cta2_href": texto("Enlace del botón secundario", "/contacto"),
            }
        ),
    },
    {
        "codigo": "producto-spotlight",
        "nombre": "Producto estrella",
        "categoria": "CONVERSION",
        "descripcion": "El más vendido, contado como publicidad: foto enorme, nombre gigante, una acción.",
        "icono": "star",
        "orden": 12,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": True,
        "variantes": [],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo", "El favorito de nuestros clientes"),
                "texto": texto("Texto", "Uno de los productos que más piden negocios como el tuyo."),
                "cta_texto": texto("Texto del botón", "Quiero este producto"),
                "omitir": texto("No usar estos productos", ayuda="Slugs separados por coma, ej. «mango». Sirve para no repetir el producto que ya sale en el hero."),
            }
        ),
    },
    {
        "codigo": "video-campana",
        "nombre": "Video de campaña",
        "categoria": "CONTENIDO",
        "descripcion": "Espacio de video publicitario. Sin video ni póster no se muestra.",
        "icono": "video",
        "orden": 14,
        "unico_por_pagina": False,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "horizontal", "nombre": "Horizontal a sangre (16:9)"},
            {"codigo": "vertical", "nombre": "Vertical (reel / story)"},
        ],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "texto": texto("Texto"),
                "video_url": texto("Video (MP4)", ayuda="Se carga al acercarse, suena en silencio y en bucle solo mientras está a la vista."),
                "video_movil_url": texto("Video para móvil (MP4, opcional)"),
                "poster_url": texto("Póster (foto)", ayuda="Lo que se ve mientras carga, y sin movimiento si el visitante lo pidió."),
                "video_alt": texto("Descripción del video"),
                "cta_texto": texto("Botón"),
                "cta_href": texto("Enlace del botón", "/tienda"),
            }
        ),
    },
    {
        "codigo": "campana-destacada",
        "nombre": "Campaña de imagen gigante",
        "categoria": "CONVERSION",
        "descripcion": "La foto ocupa la pantalla y el texto es mínimo: «esta semana toca esto».",
        "icono": "image",
        "orden": 16,
        "unico_por_pagina": False,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "gigante", "nombre": "Gigante (alta)"},
            {"codigo": "cinematico", "nombre": "Cinematográfica (banner ancho)"},
        ],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "texto": texto("Texto"),
                "imagen": texto("Foto (URL)"),
                "imagen_movil": texto("Foto para móvil (URL, opcional)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "enfoque": texto("Enfoque en escritorio", "50% 50%", ENFOQUE),
                "enfoque_movil": texto("Enfoque en móvil"),
                "cta_texto": texto("Botón"),
                "cta_href": texto("Enlace del botón", "/tienda"),
                "alineacion": texto("Alineación (izquierda o centro)", "izquierda"),
            }
        ),
    },
    {
        "codigo": "campana-editorial",
        "nombre": "Campaña editorial",
        "categoria": "CONVERSION",
        "descripcion": "Composición de revista: foto alta, texto con una palabra en serif, precio en vivo y un botón.",
        "icono": "newspaper",
        "orden": 18,
        "unico_por_pagina": False,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "imagen-izquierda", "nombre": "Foto a la izquierda"},
            {"codigo": "imagen-derecha", "nombre": "Foto a la derecha"},
        ],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "titulo_resaltado": texto("Titular resaltado (serif cursiva)"),
                "texto": texto("Texto"),
                "imagen": texto("Foto (URL)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "enfoque": texto("Enfoque de la foto", "50% 50%", ENFOQUE),
                "producto_slug": texto("Producto (slug)", ayuda="Si lo pones, el precio «Desde» se lee del catálogo en vivo y el botón lleva a su ficha."),
                "precio_texto": texto("Leyenda de precio manual", ayuda="Para campañas que no son un producto. Anula el precio en vivo."),
                "cta_texto": texto("Botón"),
                "cta_href": texto("Enlace del botón", ayuda="Vacío: la ficha del producto, o la tienda."),
            }
        ),
    },
    {
        "codigo": "campana-negocios",
        "nombre": "Campaña para negocios",
        "categoria": "CONVERSION",
        "descripcion": "La pieza B2B: restaurantes, hoteles, cafeterías y comercios. Lleva el ancla del menú «Para negocios».",
        "icono": "briefcase",
        "orden": 20,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": True,
        "variantes": [],
        "esquema_props": objeto(
            {
                "ancla": texto("Ancla del menú", "negocios"),
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "titulo_resaltado": texto("Titular resaltado (serif cursiva)"),
                "texto": texto("Texto"),
                "segmentos": lista(
                    "Tipos de negocio",
                    {"titulo": texto("Negocio"), "texto": texto("Beneficio")},
                ),
                "imagen": texto("Foto (URL)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "cta_texto": texto("Botón principal", "Abastecer mi negocio"),
                "cta_href": texto("Enlace del botón principal", "/contacto"),
                "cta2_texto": texto("Botón secundario"),
                "cta2_href": texto("Enlace del botón secundario", "/tienda"),
            }
        ),
    },
    {
        "codigo": "historia-marca",
        "nombre": "Historia de marca (scroll)",
        "categoria": "CONTENIDO",
        "descripcion": "Escenario fijo a pantalla completa; la foto y el capítulo cambian mientras se baja.",
        "icono": "book-open",
        "orden": 13,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "capitulos": lista(
                    "Capítulos",
                    {
                        "etiqueta": texto("Etiqueta corta (aparece en la barra de progreso)"),
                        "titulo": texto("Titular"),
                        "texto": texto("Texto"),
                        "imagen": texto("Foto (URL)", ayuda="Sin foto el capítulo usa un fondo verde de marca."),
                        "enfoque": texto("Enfoque de la foto", "50% 50%", ENFOQUE),
                    },
                ),
                "cta_texto": texto("Botón (aparece en el último capítulo)"),
                "cta_href": texto("Enlace del botón", "/tienda"),
            }
        ),
    },
    {
        "codigo": "testimonios-editorial",
        "nombre": "Testimonios editoriales",
        "categoria": "PRUEBA_SOCIAL",
        "descripcion": "Los testimonios reales, como citas grandes en una pista deslizable.",
        "icono": "quote",
        "orden": 22,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": True,
        "variantes": [],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo", "Negocios que confían en nosotros"),
                "titulo": texto("Titular"),
            }
        ),
    },
    {
        "codigo": "cierre-cta",
        "nombre": "Cierre con llamada a la acción",
        "categoria": "CONVERSION",
        "descripcion": "La última imagen del recorrido y una invitación a entrar; con WhatsApp opcional.",
        "icono": "flag",
        "orden": 30,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": objeto(
            {
                "kicker": texto("Antetítulo"),
                "titulo": texto("Titular"),
                "titulo_resaltado": texto("Titular resaltado (serif cursiva)"),
                "texto": texto("Texto"),
                "imagen": texto("Foto (URL)"),
                "imagen_alt": texto("Texto alternativo de la foto"),
                "enfoque": texto("Enfoque de la foto", "50% 50%", ENFOQUE),
                "cta_texto": texto("Botón principal", "Entrar a la tienda"),
                "cta_href": texto("Enlace del botón principal", "/tienda"),
                "whatsapp_texto": texto("Botón de WhatsApp", ayuda="Vacío: no se muestra. Usa el número configurado en el sitio."),
                "whatsapp_mensaje": texto("Mensaje inicial de WhatsApp", "Hola, quiero hacer un pedido."),
            }
        ),
    },
]

# ------------------------------------------------------------ composición
FOTO_HUERTO = "/img/home/hero-huerto.webp"
FOTO_LULO = (
    "https://pub-d9ed2b3f0c8c4677a9b68b7dcf17e565.r2.dev/media/tenants/"
    "f7ab4600-83cb-42ab-b17a-d694532d8b71/productos/"
    "bd617316d50049649e0ad00026fcce92-lulo.jpg"
)

HOME_CAMPANAS = [
    {
        "id": "hero-campana-0",
        "tipo": "hero-campana",
        "props": {
            "kicker": "La Gran Cosecha · Soacha, Cundinamarca",
            "titulo": "Del campo",
            "titulo_resaltado": "a tu mesa.",
            "subtitulo": "Frescura que se nota.",
            "imagen": FOTO_HUERTO,
            "imagen_alt": "Mangos frescos sobre una mesa de madera, con un huerto de mango al fondo",
            "enfoque": "50% 60%",
            "enfoque_movil": "52% 60%",
            "cta_texto": "Comprar ahora",
            "cta_href": "/tienda",
            "cta2_texto": "Abastecer mi negocio",
            "cta2_href": "/#negocios",
        },
    },
    {
        "id": "producto-spotlight-1",
        "tipo": "producto-spotlight",
        "props": {
            "kicker": "El favorito de nuestros clientes",
            "texto": "Uno de los productos que más piden negocios como el tuyo.",
            "cta_texto": "Quiero este producto",
            "omitir": "mango",
        },
    },
    {
        # Video 2: campañas / "los favoritos de esta semana". Vacío = no se pinta.
        "id": "video-campana-favoritos",
        "tipo": "video-campana",
        "variante": "horizontal",
        "props": {
            "kicker": "Los favoritos de esta semana",
            "titulo": "",
            "video_url": "",
            "poster_url": "",
            "cta_texto": "Ver los productos",
            "cta_href": "/tienda",
        },
    },
    {
        "id": "historia-marca-3",
        "tipo": "historia-marca",
        "props": {
            "kicker": "Cómo trabajamos",
            "capitulos": [
                {
                    "etiqueta": "El campo",
                    "titulo": "Todo empieza en el campo colombiano.",
                    "texto": "Frutas, verduras, tubérculos y granos: producto colombiano, del campo a tu negocio.",
                    "imagen": "/img/home/campo-amanecer.webp",
                    "enfoque": "50% 55%",
                },
                {
                    "etiqueta": "La selección",
                    "titulo": "Madrugamos para elegir lo mejor.",
                    "texto": "Cada madrugada vamos al abasto y seleccionamos el producto fresco, pieza por pieza.",
                    "imagen": "/img/home/mango-macro.webp",
                    "enfoque": "50% 50%",
                },
                {
                    "etiqueta": "Un solo pedido",
                    "titulo": "Todo lo que necesitas, en un solo pedido.",
                    "texto": "Frutas, verduras, tubérculos, granos y más en un solo lugar. Tú eliges; nosotros lo consolidamos.",
                    "imagen": "/img/hero-tienda.webp",
                    "enfoque": "50% 50%",
                },
                {
                    "etiqueta": "La entrega",
                    "titulo": "En tu puerta, fresco y a tiempo.",
                    "texto": "Preparamos tu pedido y lo entregamos en tu negocio, completo y puntual.",
                    "imagen": "/img/home/abastecimiento.webp",
                    "enfoque": "72% 50%",
                },
            ],
            "cta_texto": "Ver los productos",
            "cta_href": "/tienda",
        },
    },
    {
        # Video 3: historia de marca. Vacío = no se pinta.
        "id": "video-campana-marca",
        "tipo": "video-campana",
        "variante": "horizontal",
        "props": {
            "kicker": "Nuestra historia",
            "titulo": "",
            "video_url": "",
            "poster_url": "",
        },
    },
    {
        "id": "campana-editorial-5",
        "tipo": "campana-editorial",
        "variante": "imagen-derecha",
        "props": {
            "kicker": "Selección destacada",
            "titulo": "Lulo,",
            "titulo_resaltado": "intenso y fresco.",
            "texto": "Para jugos, salsas y postres: lulo seleccionado, listo para tu cocina.",
            "imagen": FOTO_LULO,
            "imagen_alt": "Lulos frescos en primer plano",
            "enfoque": "50% 50%",
            "producto_slug": "lulo",
            "cta_texto": "Quiero lulo",
        },
    },
    {
        "id": "campana-negocios-6",
        "tipo": "campana-negocios",
        "props": {
            "ancla": "negocios",
            "kicker": "Para restaurantes, hoteles y comercios",
            "titulo": "Tu negocio también necesita",
            "titulo_resaltado": "frescura.",
            "texto": "Abastécete sin ir al abasto: seleccionamos, preparamos y entregamos tu pedido para que tu operación no se detenga.",
            "segmentos": [
                {"titulo": "Restaurantes", "texto": "Abastece tu cocina con productos frescos sin salir de tu negocio."},
                {"titulo": "Hoteles y más negocios", "texto": "Soluciones de abastecimiento confiables para tu operación diaria."},
                {"titulo": "Comercios y cafeterías", "texto": "Haz pedidos fáciles y recibe todo lo que necesitas en un solo lugar."},
                {"titulo": "Fruterías y tiendas", "texto": "Encuentra frutas y productos de calidad para tu negocio todos los días."},
            ],
            "imagen": "/img/home/abastecimiento.webp",
            "imagen_alt": "Cajón de frutas y verduras junto al camión de reparto de La Gran Cosecha",
            "cta_texto": "Abastecer mi negocio",
            "cta_href": "/contacto",
            "cta2_texto": "Hacer mi pedido",
            "cta2_href": "/tienda",
        },
    },
    {
        "id": "testimonios-editorial-7",
        "tipo": "testimonios-editorial",
        "props": {
            "kicker": "Negocios que confían en nosotros",
            "titulo": "Lo dicen quienes ya nos piden.",
        },
    },
    {
        "id": "cierre-cta-8",
        "tipo": "cierre-cta",
        "props": {
            "kicker": "La Gran Cosecha",
            "titulo": "Entra a la",
            "titulo_resaltado": "tienda.",
            "texto": "Frutas, verduras, tubérculos, granos y más, en un solo pedido.",
            "imagen": FOTO_HUERTO,
            "imagen_alt": "",
            "enfoque": "50% 60%",
            "cta_texto": "Entrar a la tienda",
            "cta_href": "/tienda",
            "whatsapp_texto": "Escribir por WhatsApp",
            "whatsapp_mensaje": "Hola, quiero hacer un pedido en La Gran Cosecha.",
        },
    },
]

VISIBLE = {"movil": True, "tablet": True, "escritorio": True}


def _componer(lista_bruta):
    return [
        {
            "id": b["id"],
            "tipo": b["tipo"],
            "variante": b.get("variante", ""),
            "props": b.get("props", {}),
            "visible": dict(VISIBLE),
        }
        for b in lista_bruta
    ]


# ---------------------------------------------------------------- armazón
def _armazon(composicion):
    """Menú nuevo y botón «Comprar» en la cabecera; ancla correcta en el pie.
    Devuelve (composicion, cambiado)."""
    cambiado = False
    nueva = []
    for bloque in composicion:
        bloque = dict(bloque)
        props = dict(bloque.get("props") or {})
        if bloque.get("tipo") == "cabecera" and not props.get("boton_texto"):
            props["enlaces"] = [
                {"href": "/", "texto": "Inicio", "exacto": True},
                {"href": "/tienda", "texto": "Tienda", "exacto": False},
                {"href": "/#negocios", "texto": "Para negocios", "exacto": False},
                {"href": "/nosotros", "texto": "Nosotros", "exacto": False},
                {"href": "/contacto", "texto": "Contacto", "exacto": False},
            ]
            props["boton_texto"] = "Comprar"
            props["boton_href"] = "/tienda"
            bloque["props"] = props
            cambiado = True
        elif bloque.get("tipo") == "pie":
            enlaces = []
            for e in props.get("enlaces") or []:
                if e.get("texto") == "Para negocios" and e.get("href") != "/#negocios":
                    e = {**e, "href": "/#negocios"}
                    cambiado = True
                enlaces.append(e)
            if enlaces:
                props["enlaces"] = enlaces
                bloque["props"] = props
        nueva.append(bloque)
    return nueva, cambiado


def _publicar(Pagina, VersionPagina, tenant, ruta, nueva_composicion, nota):
    pagina = Pagina.objects.filter(tenant=tenant, ruta=ruta).first()
    if pagina is None:
        return None

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is not None:
        publicada.estado = "ARCHIVADA"
        publicada.save(update_fields=["estado"])

    ultimo = pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo + 1,
        estado="PUBLICADA",
        composicion=nueva_composicion,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()
    return pagina


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 1. Catálogo: los bloques nuevos...
    for datos in BLOQUES:
        Bloque.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    # ...y las dos propiedades nuevas de la cabecera.
    cabecera = Bloque.objects.filter(codigo="cabecera").first()
    if cabecera is not None:
        esquema = dict(cabecera.esquema_props or {"tipo": "object"})
        propiedades = dict(esquema.get("properties") or {})
        cambiado = False
        if "boton_texto" not in propiedades:
            propiedades["boton_texto"] = texto(
                "Botón de compra (solo escritorio)",
                ayuda="Un botón «Comprar» junto al carrito. Vacío: no se muestra.",
            )
            cambiado = True
        if "boton_href" not in propiedades:
            propiedades["boton_href"] = texto("Enlace del botón de compra", "/tienda")
            cambiado = True
        if cambiado:
            esquema["properties"] = propiedades
            cabecera.esquema_props = esquema
            cabecera.save(update_fields=["esquema_props"])

    composicion = _componer(HOME_CAMPANAS)

    # 2. El molde.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas["/"] = composicion
        if paginas.get("/_layout"):
            nuevo_armazon, _ = _armazon(paginas["/_layout"])
            paginas["/_layout"] = nuevo_armazon
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    # 3. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    home = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if home is not None:
        publicada = home.versiones.filter(estado="PUBLICADA").first()
        ya_aplicado = publicada is not None and any(
            b.get("tipo") == "hero-campana" for b in (publicada.composicion or [])
        )
        if not ya_aplicado:
            # El SEO solo se toca si sigue siendo el que sembró 0028: si alguien
            # lo escribió a mano desde el panel, se respeta.
            if not home.seo_titulo or home.seo_titulo == SEO_TITULO_ANTERIOR:
                home.seo_titulo = SEO_TITULO
                home.seo_descripcion = SEO_DESCRIPCION
                home.save(update_fields=["seo_titulo", "seo_descripcion"])
            _publicar(
                Pagina,
                VersionPagina,
                tenant,
                "/",
                composicion,
                "Home publicitario: hero de campaña, favorito, historia de marca, "
                "negocios, testimonios y cierre.",
            )

    armazon = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if armazon is not None:
        publicada = armazon.versiones.filter(estado="PUBLICADA").first()
        if publicada is not None:
            nuevo, cambiado = _armazon(list(publicada.composicion or []))
            if cambiado:
                _publicar(
                    Pagina,
                    VersionPagina,
                    tenant,
                    "/_layout",
                    nuevo,
                    "Menú: Inicio, Tienda, Para negocios, Nosotros, Contacto y botón Comprar.",
                )


def revertir(apps, schema_editor):
    # Mismo criterio que 0028/0030/0044: no se deshace contenido publicado en
    # automático. Volver atrás de verdad es «Restaurar versión» en el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0044_tienda_rediseno_ux_producto_destacado"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
