"""
"/contacto" deja de ser un formulario: convierte una necesidad en una acción.

# La pregunta que responde

"Tengo una necesidad de abastecimiento: ¿quién me ayuda a resolverla?". La
página no empieza pidiendo nombre y correo; pregunta QUÉ necesita el
cliente y solo después pide lo que ese camino necesita. Seis bloques nuevos
(ver `frontend/tienda/src/bloques/contacto/`) y dos de las campañas:

    contacto-hero         "Tu negocio necesita abastecerse. Nosotros te ayudamos."
    contacto-intenciones  ¿Cómo podemos ayudarte? pedido / cotización /
                          producto que no aparece / hablar con alguien
    contacto-especial     ¿No lo encuentras? Pregúntanos.
    contacto-escenarios   así podemos ayudarte, cada escenario con su acción
    video-campana         el espacio del video "Así trabajamos para tu negocio"
    contacto-whatsapp     ¿Prefieres hablar directamente? Hablemos por WhatsApp.
    contacto-datos        habla con nosotros: cada dato es una acción
    cierre-cta            "Cuéntanos qué necesitas. Nosotros nos encargamos del resto."

Los botones de la página abren los caminos del selector con enlaces
(`#cotizar`, `#buscar-producto`, `#hacer-pedido`, `#hablar`), que también
funcionan desde otras páginas (`/contacto#cotizar`).

# Qué recibe el backend

Las solicitudes van a `contact.MensajeContacto` con su `motivo`
(`contact/0007`). Los datos propios de cada caso —tipo de negocio, cantidad,
fecha— van redactados en el mensaje: los lee una persona.

# Qué NO hace

* No inventa. Teléfono, WhatsApp, correo y ubicación salen de la
  configuración del negocio; sin horario configurado no hay horario. No hay
  tiempos de respuesta ni promesas de conseguir "cualquier producto": la
  nota de `contacto-especial` dice que se revisa y se confirma.
* No usa fotos de banco como si fueran de la operación. Las fotos son de
  producto del propio catálogo; el hero y los escenarios tienen su espacio
  de foto/video (`imagen`, `video_url`…) para cuando exista material real
  de cajas, preparación o entregas. El video no se pinta sin URL.

# Reversible

La composición anterior queda ARCHIVADA ("Restaurar versión" en el panel), y
los bloques que salen de esta página (`portada`, `cotizacion-rapida`,
`insignias-confianza`) siguen en el catálogo.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

SEO_TITULO = "Contacto: cuéntanos qué necesita tu negocio"
SEO_DESCRIPCION = (
    "Haz tu pedido, cotiza una compra grande o pregúntanos por un producto que "
    "no aparece en el catálogo. Escríbenos por WhatsApp o déjanos tu solicitud."
)

R2 = "https://pub-d9ed2b3f0c8c4677a9b68b7dcf17e565.r2.dev/media/tenants/f7ab4600-83cb-42ab-b17a-d694532d8b71"

# Fotos de producto del propio catálogo (las mismas que usa /nosotros).
MANGO = {"imagen": "/img/home/mango-macro.webp", "alt": "Mangos frescos"}
LULO = {"imagen": f"{R2}/productos/bd617316d50049649e0ad00026fcce92-lulo.jpg", "alt": "Lulos frescos"}
BANANO = {"imagen": f"{R2}/productos/7e987378b5874cef897a06a01e56d05d-bananos.webp", "alt": "Racimos de banano"}
GUAYABA = {"imagen": f"{R2}/productos/e15a3e81f81f476f88183ca7ff28873f-guayaba.jpg", "alt": "Guayabas frescas"}
TOMATE_ARBOL = {"imagen": f"{R2}/productos/ff3433450e8b4b188c64c72dd081e9c7-_NoaHWht.jpg", "alt": "Tomates de árbol"}
PINA = {"imagen": f"{R2}/productos/40a71c3cd81c42c4b1297b7e7c586d13-pina.webp", "alt": "Piña fresca"}
MANGO_BIBLIOTECA = {"imagen": f"{R2}/biblioteca/2026/09/ee52e1210c3a4878ab83a79a_eZST5Zv.jpg", "alt": "Mangos"}


# ---------------------------------------------------------------- esquemas
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def booleano(titulo, defecto=True):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


def lista(titulo, propiedades):
    return {"tipo": "array", "titulo": titulo, "items": {"tipo": "object", "properties": propiedades}}


def lista_textos(titulo):
    return {"tipo": "array", "titulo": titulo, "items": {"tipo": "string"}}


def objeto(propiedades):
    return {"tipo": "object", "properties": propiedades}


INTENCION = texto(
    "Camino (pedido, cotizacion, producto o hablar)",
    ayuda="Decide qué se abre: un pedido lleva a la tienda; los demás, su formulario.",
)

ENLACES = "#hacer-pedido, #cotizar, #buscar-producto o #hablar abren un camino del selector."

# Los campos de un espacio de foto/video (ver `nosotros/Medio.tsx`).
MEDIO = {
    "imagen": texto("Foto (URL)"),
    "imagen_movil": texto("Foto vertical para móvil (URL, opcional)"),
    "video_url": texto("Video (MP4, opcional)", ayuda="Se carga después de la foto, en silencio y en bucle, solo mientras se ve."),
    "video_movil_url": texto("Video vertical para móvil (MP4, opcional)", ayuda="En móvil nunca se descarga el de escritorio."),
    "alt": texto("Qué muestra (para lectores de pantalla)"),
    "enfoque": texto("Enfoque", "50% 50%", "Punto de la foto que se mantiene a la vista, ej. «50% 60%»."),
    "enfoque_movil": texto("Enfoque en móvil"),
    "ajuste": texto("Ajuste («cubrir» o «contener»)", "cubrir"),
}

FOTOS = lista("Fotos de producto", {"imagen": texto("Foto (URL)"), "alt": texto("Qué muestra")})


def bloque(codigo, nombre, descripcion, icono, orden, propiedades, *, categoria="CONVERSION"):
    return {
        "codigo": codigo,
        "nombre": nombre,
        "categoria": categoria,
        "descripcion": descripcion,
        "icono": icono,
        "orden": orden,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [],
        "esquema_props": objeto(propiedades),
    }


BLOQUES = [
    bloque(
        "contacto-hero", "Hero de contacto",
        "Titular en dos tiempos, los botones de hablar y ver productos, fotos de producto y atajos a cada camino.",
        "message-circle", 16,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular (primera línea)"),
            "titulo_resaltado": texto("Titular (segunda línea, serif cursiva)"),
            "texto": texto("Texto"),
            "cta_texto": texto("Botón principal"),
            "cta_href": texto("Enlace del botón principal", "#hablar", ENLACES),
            "cta2_texto": texto("Botón secundario"),
            "cta2_href": texto("Enlace del botón secundario", "/tienda"),
            "atajos_titulo": texto("Título de los atajos"),
            "atajos": lista("Atajos", {"clave": INTENCION, "texto": texto("Texto")}),
            "fotos": FOTOS,
            **MEDIO,
        },
        categoria="ESTRUCTURA",
    ),
    bloque(
        "contacto-intenciones", "¿Cómo podemos ayudarte?",
        "Cuatro caminos (pedido, cotización, producto especial, hablar) y, al elegir, solo el formulario de ese camino.",
        "signpost", 17,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular", "¿Cómo podemos ayudarte?"),
            "texto": texto("Texto"),
            "opciones": lista(
                "Caminos",
                {
                    "clave": INTENCION,
                    "titulo": texto("Título"),
                    "texto": texto("Texto"),
                    "accion": texto("Acción"),
                    "icono": texto("Ícono (archivo de /icons3d)"),
                    "panel_titulo": texto("Título al abrirlo"),
                    "panel_texto": texto("Texto al abrirlo"),
                },
            ),
            "barra_movil": booleano("Barra [Pedido] [WhatsApp] en móvil", True),
        },
    ),
    bloque(
        "contacto-especial", "¿No lo encuentras?",
        "Productos fuera del catálogo: una estantería que se sale del marco y el botón para decir qué se busca.",
        "search", 18,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "texto": texto("Texto"),
            "ejemplos": lista_textos("Ejemplos"),
            "nota": texto("Nota (qué se puede esperar)"),
            "cta_texto": texto("Botón"),
            "cta_href": texto("Enlace del botón", "#buscar-producto", ENLACES),
            "hueco_texto": texto("Texto del espacio vacío", "Lo que buscas"),
            "fotos": FOTOS,
        },
    ),
    bloque(
        "contacto-escenarios", "Así podemos ayudarte",
        "Situaciones de compra, cada una con foto (o ícono) y su acción.",
        "layout-grid", 19,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "escenarios": lista(
                "Escenarios",
                {
                    "titulo": texto("Título"),
                    "texto": texto("Texto"),
                    "cta_texto": texto("Acción"),
                    "cta_href": texto("Enlace de la acción", ayuda=ENLACES),
                    "icono": texto("Ícono (archivo de /icons3d)"),
                    **MEDIO,
                },
            ),
        },
        categoria="CONTENIDO",
    ),
    bloque(
        "contacto-whatsapp", "Hablemos por WhatsApp",
        "WhatsApp como acción: el botón grande y el chat con el mensaje que ya va escrito. Usa el número del negocio.",
        "message-square", 20,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "texto": texto("Texto"),
            "cta_texto": texto("Botón", "Abrir WhatsApp"),
            "mensaje": texto("Mensaje que ya va escrito"),
            "nota_chat": texto("Nota dentro del chat"),
        },
    ),
    bloque(
        "contacto-datos", "Habla con nosotros",
        "WhatsApp, teléfono, correo, ubicación y horario del negocio, cada uno con su acción. Lo no configurado no se muestra.",
        "contact", 21,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular", "Habla con nosotros"),
            "whatsapp_mensaje": texto("Mensaje de WhatsApp"),
            "correo_asunto": texto("Asunto del correo"),
        },
    ),
]


# -------------------------------------------------------------- composición
def _b(identificador, tipo, props, variante=""):
    return {
        "id": identificador,
        "tipo": tipo,
        "variante": variante,
        "props": props,
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


CONTACTO = [
    _b("contacto-hero-0", "contacto-hero", {
        "kicker": "¿Qué necesitas para tu negocio?",
        "titulo": "Tu negocio necesita abastecerse.",
        "titulo_resaltado": "Nosotros te ayudamos.",
        "texto": (
            "Cuéntanos qué necesitas, desde un pedido del catálogo hasta una "
            "compra grande o un producto especial."
        ),
        "cta_texto": "Hablar con el equipo",
        "cta_href": "#hablar",
        "cta2_texto": "Ver productos",
        "cta2_href": "/tienda",
        "atajos_titulo": "¿Qué necesitas hoy?",
        "atajos": [
            {"clave": "pedido", "texto": "Un pedido del catálogo"},
            {"clave": "cotizacion", "texto": "Una compra grande"},
            {"clave": "producto", "texto": "Un producto especial"},
        ],
        "fotos": [MANGO, PINA, LULO, BANANO],
        # Espacio para la foto o el video real de la operación (cajas,
        # preparación, una entrega). Vacío: el hero se cuenta sobre el verde.
        "imagen": "", "imagen_movil": "", "video_url": "", "video_movil_url": "", "alt": "",
    }),
    _b("contacto-intenciones-1", "contacto-intenciones", {
        "kicker": "Empieza aquí",
        "titulo": "¿Cómo podemos ayudarte?",
        "texto": "Elige lo que se parece a tu necesidad y te pedimos solo lo necesario.",
        "barra_movil": True,
        "opciones": [
            {
                "clave": "pedido",
                "titulo": "Quiero hacer un pedido",
                "texto": "Ya sé qué necesito.",
                "accion": "Hacer mi pedido",
                "icono": "canasta.png",
                "panel_titulo": "Arma tu pedido en la tienda",
                "panel_texto": "Eliges los productos y las cantidades, y lo recibes donde trabajas.",
            },
            {
                "clave": "cotizacion",
                "titulo": "Necesito una cotización",
                "texto": "Tengo una compra grande.",
                "accion": "Solicitar cotización",
                "icono": "lista.png",
                "panel_titulo": "¿Tienes un pedido grande?",
                "panel_texto": "Cuéntanos qué necesitas y te ayudamos a revisar disponibilidad y precio.",
            },
            {
                "clave": "producto",
                "titulo": "No encuentro el producto",
                "texto": "Necesito algo que no aparece en el catálogo.",
                "accion": "Cuéntanos qué buscas",
                "icono": "buscar.png",
                "panel_titulo": "¿Qué estás buscando?",
                "panel_texto": "Dinos qué necesitas. Revisamos si podemos conseguirlo y te confirmamos disponibilidad y precio.",
            },
            {
                "clave": "hablar",
                "titulo": "Necesito hablar con alguien",
                "texto": "Tengo una pregunta o un requerimiento especial.",
                "accion": "Hablar con el equipo",
                "icono": "soporte.png",
                "panel_titulo": "Hablemos",
                "panel_texto": "Escríbenos directo o déjanos tu mensaje y te respondemos.",
            },
        ],
    }),
    _b("contacto-especial-2", "contacto-especial", {
        "kicker": "Compras especiales",
        "titulo": "¿No lo encuentras?",
        "titulo_resaltado": "Pregúntanos.",
        "texto": "No todo lo que conseguimos tiene que aparecer en el catálogo.",
        "ejemplos": [
            "Una variedad o un tamaño específico",
            "Más cantidad de la que ves publicada",
            "Un producto que no está en la tienda",
        ],
        "nota": "Revisamos si podemos conseguirlo y te confirmamos disponibilidad y precio. Si no se puede, también te lo decimos.",
        "cta_texto": "Decirnos qué buscas",
        "cta_href": "#buscar-producto",
        "hueco_texto": "Lo que buscas",
        "fotos": [LULO, BANANO, GUAYABA, TOMATE_ARBOL, PINA, MANGO_BIBLIOTECA, MANGO],
    }),
    _b("contacto-escenarios-3", "contacto-escenarios", {
        "kicker": "Así podemos ayudarte",
        "titulo": "Cada negocio necesita",
        "titulo_resaltado": "algo distinto.",
        # Sin foto propia de cada negocio, cada escenario muestra su ícono.
        "escenarios": [
            {
                "titulo": "Para tu restaurante",
                "texto": "Abastecimiento para tu operación diaria: frutas, verduras, tubérculos y granos en un solo pedido.",
                "cta_texto": "Cotizar mi pedido",
                "cta_href": "#cotizar",
                "icono": "restaurante.png",
                "imagen": "", "video_url": "",
            },
            {
                "titulo": "Para tu frutería",
                "texto": "Productos frescos para mantener tu vitrina surtida.",
                "cta_texto": "Ver productos",
                "cta_href": "/tienda",
                "icono": "canasta.png",
                "imagen": "", "video_url": "",
            },
            {
                "titulo": "Para tu negocio",
                "texto": "Cafetería, tienda o comercio: cuéntanos qué necesitas.",
                "cta_texto": "Hablar con el equipo",
                "cta_href": "#hablar",
                "icono": "caja.png",
                "imagen": "", "video_url": "",
            },
            {
                "titulo": "Para compras especiales",
                "texto": "Si no aparece en el catálogo, pregúntanos.",
                "cta_texto": "Buscar un producto",
                "cta_href": "#buscar-producto",
                "icono": "buscar.png",
                "imagen": "", "video_url": "",
            },
        ],
    }),
    # Espacio del video "Así trabajamos para tu negocio" (mercado → selección
    # → preparación → entrega): sin URL no se muestra.
    _b("video-contacto", "video-campana", {
        "kicker": "Así trabajamos para tu negocio",
        "titulo": "",
        "texto": "Del mercado a la selección, la preparación y la entrega.",
        "video_url": "",
        "video_movil_url": "",
        "poster_url": "",
    }, variante="horizontal"),
    _b("contacto-whatsapp-5", "contacto-whatsapp", {
        "kicker": "¿Prefieres hablar directamente?",
        "titulo": "Hablemos por",
        "titulo_resaltado": "WhatsApp.",
        "texto": "Cuéntanos qué necesitas y nuestro equipo te orientará.",
        "cta_texto": "Abrir WhatsApp",
        "mensaje": "Hola, quiero abastecer mi negocio con La Gran Cosecha. Necesito:",
        "nota_chat": "Tu mensaje ya va escrito. Puedes cambiarlo antes de enviarlo.",
    }),
    _b("contacto-datos-6", "contacto-datos", {
        "kicker": "Todos nuestros canales",
        "titulo": "Habla con nosotros",
        "whatsapp_mensaje": "Hola, quiero más información para abastecer mi negocio.",
        "correo_asunto": "Solicitud para mi negocio",
    }),
    _b("cierre-cta-7", "cierre-cta", {
        "kicker": "La Gran Cosecha",
        "titulo": "Cuéntanos qué necesitas.",
        "titulo_resaltado": "Nosotros nos encargamos del resto.",
        "texto": "",
        "imagen": "/img/hero-tienda.webp",
        "imagen_alt": "",
        "enfoque": "50% 62%",
        "cta_texto": "Hacer mi pedido",
        "cta_href": "/tienda",
        "whatsapp_texto": "Hablar con el equipo",
        "whatsapp_mensaje": "Hola, quiero abastecer mi negocio con La Gran Cosecha.",
    }),
]


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    for datos in BLOQUES:
        Bloque.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas["/contacto"] = CONTACTO
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta="/contacto").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is not None and any(b.get("tipo") == "contacto-intenciones" for b in (publicada.composicion or [])):
        return  # ya aplicada

    if publicada is not None:
        publicada.estado = "ARCHIVADA"
        publicada.save(update_fields=["estado"])

    ultimo = pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo + 1,
        estado="PUBLICADA",
        composicion=CONTACTO,
        nota="Contacto como conversión: cuéntanos qué necesitas, nosotros vemos cómo conseguirlo.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()

    if not pagina.seo_titulo:
        pagina.seo_titulo = SEO_TITULO
    if not pagina.seo_descripcion:
        pagina.seo_descripcion = SEO_DESCRIPCION
    pagina.save(update_fields=["seo_titulo", "seo_descripcion"])


def revertir(apps, schema_editor):
    # Mismo criterio que 0046/0047: volver atrás es "Restaurar versión".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0047_nosotros_storytelling"),
        ("contact", "0007_motivo_y_correo_opcional"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
