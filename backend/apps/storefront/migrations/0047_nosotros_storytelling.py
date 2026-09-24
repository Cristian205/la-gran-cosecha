"""
"/nosotros" pasa de página corporativa a historia: por qué existe el negocio.

# La pregunta que responde

"¿Por qué debería confiarle a La Gran Cosecha el abastecimiento de mi
negocio?". El concepto: MIENTRAS TÚ TRABAJAS, NOSOTROS VAMOS POR TU MERCADO.
La página recorre la luz de un día de trabajo —de la madrugada en el abasto
a la mañana en el negocio del cliente— con diez bloques nuevos (ver
`frontend/tienda/src/bloques/nosotros/`) y tres de las campañas del Home:

    nosotros-hero        el titular, sobre la foto/video de la madrugada
    nosotros-origen      por qué existimos (la historia real del negocio)
    nosotros-proceso     así funciona: cinco escenas en un escenario fijo
    nosotros-invisible   lo que tú ves / lo que nosotros hacemos
    nosotros-tiempo      ¿cuánto te toma abastecerte? (sin cifras)
    nosotros-equipo      detrás de cada pedido hay un equipo
    nosotros-negocios    para quién existimos
    nosotros-compromisos los valores como comportamientos
    nosotros-precio      el precio cambia, la transparencia no
    nosotros-manifiesto  "no solo llevamos productos"
    video-campana        el espacio del video "las personas detrás"
    testimonios-editorial las voces reales de los clientes
    cierre-cta           el cierre de la historia

"Así funciona La Gran Cosecha" y el recorrido 01–05 del encargo son la misma
historia contada dos veces; aquí es UNA sola pieza (`nosotros-proceso`).

# Qué NO hace

* No inventa. Los textos salen de lo que el sitio ya afirma (la historia del
  negocio, "cada madrugada seleccionamos", la política de precio del día de
  `AvisoPrecios`) o del propio encargo. No hay años, cifras, clientes ni
  certificaciones: `nosotros-origen` trae `datos` vacío para cuando existan.
* No usa fotos de banco de imágenes como si fueran del negocio. Hoy no hay
  fotografía de la madrugada en el abasto, del equipo ni de una entrega:
  esas escenas se cuentan con tipografía y luz, y cada una tiene su espacio
  de foto/video (`imagen`, `imagen_movil`, `video_url`, `video_movil_url`)
  listo en el panel. Las piezas del equipo sin medio no se pintan.

# Reversible

La composición anterior queda ARCHIVADA ("Restaurar versión" en el panel), y
los bloques que sale de esta página (`portada`, `texto-libre`,
`por-que-elegirnos`, `estadisticas`, `testimonios`, `cta-banda`) siguen en el
catálogo para cualquier otra.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

SEO_TITULO = "Nosotros: vamos al abasto por tu negocio"
SEO_DESCRIPCION = (
    "Cada madrugada seleccionamos producto fresco en el abasto y lo llevamos a "
    "restaurantes, fruterías y comercios. Así funciona La Gran Cosecha."
)

R2 = "https://pub-d9ed2b3f0c8c4677a9b68b7dcf17e565.r2.dev/media/tenants/f7ab4600-83cb-42ab-b17a-d694532d8b71"


# ---------------------------------------------------------------- esquemas
def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def lista(titulo, propiedades):
    return {"tipo": "array", "titulo": titulo, "items": {"tipo": "object", "properties": propiedades}}


def lista_textos(titulo):
    return {"tipo": "array", "titulo": titulo, "items": {"tipo": "string"}}


def objeto(propiedades):
    return {"tipo": "object", "properties": propiedades}


ENFOQUE = "Punto de la foto que se mantiene a la vista, ej. «50% 60%»."

# Los campos de un espacio de foto/video (ver `nosotros/Medio.tsx`).
MEDIO = {
    "imagen": texto("Foto (URL)"),
    "imagen_movil": texto("Foto vertical para móvil (URL, opcional)"),
    "video_url": texto("Video (MP4, opcional)", ayuda="Se carga después de la foto, en silencio y en bucle, solo mientras se ve."),
    "video_movil_url": texto("Video vertical para móvil (MP4, opcional)", ayuda="En móvil nunca se descarga el de escritorio."),
    "alt": texto("Qué muestra (para lectores de pantalla)"),
    "enfoque": texto("Enfoque", "50% 50%", ENFOQUE),
    "enfoque_movil": texto("Enfoque en móvil"),
    "ajuste": texto("Ajuste («cubrir» o «contener»)", "cubrir"),
}


def bloque(codigo, nombre, descripcion, icono, orden, propiedades, *, categoria="CONTENIDO", unico=True, datos=False):
    return {
        "codigo": codigo,
        "nombre": nombre,
        "categoria": categoria,
        "descripcion": descripcion,
        "icono": icono,
        "orden": orden,
        "unico_por_pagina": unico,
        "a_sangre": True,
        "requiere_datos": datos,
        "variantes": [],
        "esquema_props": objeto(propiedades),
    }


BLOQUES = [
    bloque(
        "nosotros-hero", "Hero de historia",
        "Foto o video a pantalla completa, titular en dos tiempos y el recorrido del pedido.",
        "sunrise", 6,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular (primera línea)"),
            "titulo_resaltado": texto("Titular (segunda línea, serif cursiva)"),
            "subtitulo": texto("Subtítulo"),
            "recorrido": lista_textos("Recorrido (paradas de la ruta)"),
            "cta_texto": texto("Botón principal"),
            "cta_href": texto("Enlace del botón principal", "#como-lo-hacemos"),
            "cta2_texto": texto("Botón secundario"),
            "cta2_href": texto("Enlace del botón secundario", "/tienda"),
            **MEDIO,
        },
        categoria="ESTRUCTURA",
    ),
    bloque(
        "nosotros-origen", "Por qué existimos",
        "Un párrafo grande que se ilumina palabra por palabra al hacer scroll. Admite cifras reales.",
        "quote", 7,
        {
            "ancla": texto("Ancla"),
            "kicker": texto("Antetítulo"),
            "texto": texto("Texto"),
            "resaltadas": lista_textos("Palabras en ámbar"),
            "firma": texto("Firma"),
            "datos": lista("Cifras reales (solo se muestran las que tengan valor)", {"valor": texto("Valor"), "etiqueta": texto("Qué mide")}),
        },
    ),
    bloque(
        "nosotros-proceso", "Proceso en escenas",
        "El proceso contado con el scroll: escenas a pantalla completa con foto o video cada una.",
        "film", 8,
        {
            "ancla": texto("Ancla", "como-lo-hacemos"),
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "escenas": lista(
                "Escenas",
                {
                    "etiqueta": texto("Etiqueta"),
                    "titulo": texto("Titular"),
                    "texto": texto("Texto"),
                    "tono": texto("Luz de la escena (noche, alba, dia, claro)", "noche"),
                    **MEDIO,
                },
            ),
        },
    ),
    bloque(
        "nosotros-invisible", "Lo que tú ves / lo que hacemos",
        "La cadena de trabajo detrás de una entrega, con desplazamiento horizontal.",
        "move-horizontal", 9,
        {
            "kicker": texto("Antetítulo"),
            "titulo_ves": texto("Título de lo que ve el cliente", "Lo que tú ves"),
            "ves": texto("Lo que ve el cliente"),
            "titulo_hacemos": texto("Título del trabajo", "Lo que nosotros hacemos"),
            "pasos": lista_textos("Pasos"),
            "nota_final": texto("Nota al final"),
        },
    ),
    bloque(
        "nosotros-tiempo", "Tu tiempo vale más",
        "Las tareas del abastecimiento que se tachan al hacer scroll, sin cifras.",
        "clock", 10,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Pregunta"),
            "tareas": lista_textos("Tareas"),
            "espera": texto("Lo que cuesta"),
            "respuesta": texto("Respuesta"),
            "respuesta_resaltada": texto("Respuesta (serif cursiva)"),
            "cta_texto": texto("Botón"),
            "cta_href": texto("Enlace del botón", "/tienda"),
        },
        categoria="CONVERSION",
    ),
    bloque(
        "nosotros-equipo", "Detrás de cada pedido",
        "Mosaico de fotos o videos reales. Las piezas sin medio no se muestran.",
        "users", 11,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "texto": texto("Texto"),
            "piezas": lista("Piezas", {"etiqueta": texto("Etiqueta"), **MEDIO}),
        },
    ),
    bloque(
        "nosotros-negocios", "Para quién existimos",
        "Tipos de negocio con foto propia (o ícono mientras no la haya).",
        "store", 12,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "mensaje": texto("Mensaje"),
            "tipos": lista(
                "Tipos de negocio",
                {"nombre": texto("Nombre"), "texto": texto("Texto"), "icono": texto("Ícono (archivo de /icons3d)"), **MEDIO},
            ),
        },
    ),
    bloque(
        "nosotros-compromisos", "Compromisos",
        "Los valores contados como comportamientos: una palabra grande y lo que significa.",
        "handshake", 13,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "compromisos": lista("Compromisos", {"palabra": texto("Palabra"), "frase": texto("Frase"), "texto": texto("Texto")}),
        },
    ),
    bloque(
        "nosotros-precio", "Precio del día",
        "Explica por qué el precio cambia y qué no cambia, con un gráfico sin cifras.",
        "activity", 14,
        {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "texto": texto("Texto"),
            "puntos": lista_textos("Puntos"),
            "etiqueta_mercado": texto("Leyenda de la línea que cambia", "El mercado del día"),
            "etiqueta_promesa": texto("Leyenda de la línea fija", "Lo que te confirmamos"),
        },
    ),
    bloque(
        "nosotros-manifiesto", "Manifiesto de marca",
        "Una foto que se abre hasta ocupar la pantalla y la frase de la marca.",
        "sparkles", 15,
        {
            "titulo": texto("Titular"),
            "titulo_resaltado": texto("Titular (serif cursiva)"),
            "texto": texto("Texto"),
            **MEDIO,
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


NOSOTROS = [
    _b("nosotros-hero-0", "nosotros-hero", {
        "kicker": "Nosotros · La Gran Cosecha",
        "titulo": "Mientras tú haces crecer tu negocio,",
        "titulo_resaltado": "nosotros conseguimos lo que necesitas.",
        "subtitulo": "Seleccionamos productos frescos desde temprano para que lleguen a tu negocio listos para trabajar.",
        "recorrido": ["Madrugada", "El abasto", "La selección", "Tu negocio"],
        "cta_texto": "Conoce cómo lo hacemos",
        "cta_href": "#como-lo-hacemos",
        "cta2_texto": "Quiero abastecer mi negocio",
        "cta2_href": "/tienda",
        "imagen": "/img/home/campo-amanecer.webp",
        "imagen_movil": "",
        "video_url": "",
        "video_movil_url": "",
        "alt": "",
        "enfoque": "50% 55%",
        "enfoque_movil": "40% 60%",
    }),
    _b("nosotros-origen-1", "nosotros-origen", {
        "kicker": "Por qué existimos",
        "texto": (
            "Surgimos en el corazón del mercado local al ver lo que vivían los pequeños y "
            "medianos comercios de alimentos: madrugadas agotadoras, proveedores inconsistentes "
            "y productos de calidad variable. Nos propusimos cambiar esa realidad y ser el "
            "aliado que mantiene vivas las cocinas y estanterías de nuestra comunidad."
        ),
        "resaltadas": ["madrugadas", "agotadoras", "aliado"],
        "firma": "",
        "datos": [],
    }),
    _b("nosotros-proceso-2", "nosotros-proceso", {
        "ancla": "como-lo-hacemos",
        "kicker": "Así funciona La Gran Cosecha",
        "titulo": "Mientras tú trabajas, nosotros vamos por tu mercado.",
        "escenas": [
            {
                "etiqueta": "Madrugada",
                "titulo": "Todo comienza antes de que amanezca.",
                "texto": "Cuando la mayoría de negocios todavía no ha comenzado su jornada, nosotros ya estamos en el abasto buscando producto.",
                "tono": "noche",
                "imagen": "", "video_url": "", "video_movil_url": "",
            },
            {
                "etiqueta": "Seleccionamos",
                "titulo": "Seleccionamos.",
                "texto": "Buscamos producto que cumpla con las condiciones que necesita tu operación, pieza por pieza.",
                "tono": "alba",
                "imagen": "/img/home/mango-macro.webp",
                "enfoque": "50% 50%",
                "video_url": "", "video_movil_url": "",
            },
            {
                "etiqueta": "Organizamos",
                "titulo": "Organizamos.",
                "texto": "Frutas, verduras, tubérculos y granos: convertimos muchas compras en un solo pedido.",
                "tono": "alba",
                "imagen": "/img/hero-tienda.webp",
                "enfoque": "50% 62%",
                "video_url": "", "video_movil_url": "",
            },
            {
                "etiqueta": "Entregamos",
                "titulo": "Entregamos.",
                "texto": "Tu pedido llega listo para continuar con tu operación.",
                "tono": "claro",
                "imagen": "/img/home/abastecimiento.webp",
                "ajuste": "contener",
                "video_url": "", "video_movil_url": "",
            },
            {
                "etiqueta": "Tu negocio",
                "titulo": "Tú te concentras en tu negocio.",
                "texto": "Porque tu tiempo debería estar donde realmente genera valor.",
                "tono": "dia",
                "imagen": "", "video_url": "", "video_movil_url": "",
            },
        ],
    }),
    _b("nosotros-invisible-3", "nosotros-invisible", {
        "kicker": "Hacer visible lo invisible",
        "titulo_ves": "Lo que tú ves",
        "ves": "Una entrega.",
        "titulo_hacemos": "Lo que nosotros hacemos",
        "pasos": ["Madrugada", "Búsqueda", "Selección", "Negociación", "Organización", "Preparación", "Transporte", "Entrega"],
        "nota_final": "Cada pedido que recibes es el final de un trabajo que empezó mucho antes de que abrieras.",
    }),
    _b("nosotros-tiempo-4", "nosotros-tiempo", {
        "kicker": "Tu tiempo vale más",
        "titulo": "¿Cuánto tiempo te toma abastecerte?",
        "tareas": ["Ir al mercado", "Buscar productos", "Comparar", "Comprar", "Cargar", "Transportar", "Regresar"],
        "espera": "Mientras tanto, tu negocio sigue esperando.",
        "respuesta": "Nosotros hacemos",
        "respuesta_resaltada": "esa parte por ti.",
        "cta_texto": "Hacer mi pedido",
        "cta_href": "/tienda",
    }),
    _b("nosotros-equipo-5", "nosotros-equipo", {
        "kicker": "Detrás de cada pedido",
        "titulo": "Detrás de cada pedido",
        "titulo_resaltado": "hay un equipo.",
        "texto": "Cada pedido representa trabajo que empieza mucho antes de que llegue a tu negocio.",
        # Los espacios sin foto no se pintan: quedan listos en el panel para
        # la fotografía real del equipo. Las fotos de producto sí son reales.
        "piezas": [
            {"etiqueta": "La selección", "imagen": "", "video_url": ""},
            {"etiqueta": "Mango", "imagen": f"{R2}/biblioteca/2026/09/ee52e1210c3a4878ab83a79a_eZST5Zv.jpg", "alt": "Mangos frescos"},
            {"etiqueta": "Las personas", "imagen": "", "video_url": ""},
            {"etiqueta": "Lulo", "imagen": f"{R2}/productos/bd617316d50049649e0ad00026fcce92-lulo.jpg", "alt": "Lulos frescos"},
            {"etiqueta": "La preparación", "imagen": "", "video_url": ""},
            {"etiqueta": "Banano", "imagen": f"{R2}/productos/7e987378b5874cef897a06a01e56d05d-bananos.webp", "alt": "Racimos de banano"},
            {"etiqueta": "El vehículo", "imagen": "", "video_url": ""},
            {"etiqueta": "Guayaba", "imagen": f"{R2}/productos/e15a3e81f81f476f88183ca7ff28873f-guayaba.jpg", "alt": "Guayabas frescas"},
            {"etiqueta": "La entrega", "imagen": "", "video_url": ""},
            {"etiqueta": "Tomate de árbol", "imagen": f"{R2}/productos/ff3433450e8b4b188c64c72dd081e9c7-_NoaHWht.jpg", "alt": "Tomates de árbol"},
            {"etiqueta": "Piña", "imagen": f"{R2}/productos/40a71c3cd81c42c4b1297b7e7c586d13-pina.webp", "alt": "Piña fresca"},
        ],
    }),
    _b("nosotros-negocios-6", "nosotros-negocios", {
        "kicker": "Para quién existimos",
        "titulo": "Trabajamos para negocios",
        "titulo_resaltado": "que no pueden parar.",
        "mensaje": "Cuando tu cocina necesita producto, no puedes esperar.",
        "tipos": [
            {"nombre": "Restaurantes", "texto": "Tu cocina abre todos los días. Tu abastecimiento también tiene que llegar.", "icono": "restaurante.png", "imagen": ""},
            {"nombre": "Fruterías", "texto": "Producto fresco para tu vitrina, sin madrugar al abasto.", "icono": "canasta.png", "imagen": ""},
            {"nombre": "Cafeterías", "texto": "Frutas y productos para tu carta, en un solo pedido.", "icono": "cafeteria.png", "imagen": ""},
            {"nombre": "Comercios", "texto": "Frutas, verduras, granos y más para tu tienda.", "icono": "tienda.png", "imagen": ""},
            {"nombre": "Otros negocios", "texto": "Si tu operación depende de producto fresco, trabajamos para ti.", "icono": "edificio.png", "imagen": ""},
        ],
    }),
    _b("nosotros-compromisos-7", "nosotros-compromisos", {
        "kicker": "Cómo trabajamos",
        "titulo": "No son valores en una pared. Es lo que hacemos.",
        "compromisos": [
            {"palabra": "Selección", "frase": "No enviamos simplemente productos.", "texto": "Buscamos producto adecuado para tu operación."},
            {"palabra": "Puntualidad", "frase": "Una entrega tarde puede afectar una operación.", "texto": "Por eso la puntualidad es parte del pedido, no un extra."},
            {"palabra": "Respuesta", "frase": "Cuando un negocio necesita abastecimiento, necesita respuesta.", "texto": ""},
            {"palabra": "Relación", "frase": "Relaciones de largo plazo.", "texto": "Con nuestros clientes y con nuestros proveedores."},
        ],
    }),
    _b("nosotros-precio-8", "nosotros-precio", {
        "kicker": "Precio del día",
        "titulo": "El precio cambia.",
        "titulo_resaltado": "La transparencia no.",
        "texto": "Trabajamos con productos frescos, cuyo precio de plaza cambia de un día a otro según el mercado y la disponibilidad.",
        # La misma política que publica la tienda (AvisoPrecios).
        "puntos": [
            "Por eso el valor que ves en la tienda es una referencia del día y puede subir o bajar un poco.",
            "Antes de despachar tu pedido confirmamos contigo el valor final.",
            "Nunca cobramos algo distinto sin avisarte.",
        ],
        "etiqueta_mercado": "El mercado del día",
        "etiqueta_promesa": "Lo que te confirmamos",
    }),
    _b("nosotros-manifiesto-9", "nosotros-manifiesto", {
        "titulo": "No solo llevamos productos.",
        "titulo_resaltado": "Llevamos tranquilidad a tu operación.",
        "texto": "Porque cuando tu abastecimiento funciona, tú puedes concentrarte en hacer crecer tu negocio.",
        "imagen": "/img/home/hero-huerto.webp",
        "enfoque": "50% 60%",
        "video_url": "",
        "alt": "",
    }),
    # Espacio del video "las personas detrás": sin URL no se muestra.
    _b("video-historia", "video-campana", {
        "kicker": "Las personas detrás de La Gran Cosecha",
        "titulo": "",
        "texto": "",
        "video_url": "",
        "video_movil_url": "",
        "poster_url": "",
    }, variante="horizontal"),
    _b("testimonios-editorial-11", "testimonios-editorial", {
        "kicker": "Lo dicen quienes ya nos piden",
        "titulo": "",
    }),
    _b("cierre-cta-12", "cierre-cta", {
        "kicker": "La Gran Cosecha",
        "titulo": "Tú concentrado en tu negocio.",
        "titulo_resaltado": "Nosotros en tu abastecimiento.",
        "texto": "Empieza a preparar tu próximo pedido.",
        "imagen": "/img/home/campo-amanecer.webp",
        "imagen_alt": "",
        "enfoque": "50% 50%",
        "cta_texto": "Ver productos",
        "cta_href": "/tienda",
        "whatsapp_texto": "Hablar con nosotros",
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
        paginas["/nosotros"] = NOSOTROS
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta="/nosotros").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is not None and any(b.get("tipo") == "nosotros-hero" for b in (publicada.composicion or [])):
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
        composicion=NOSOTROS,
        nota="Nosotros como historia: mientras tú trabajas, nosotros vamos por tu mercado.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()

    if not pagina.seo_titulo:
        pagina.seo_titulo = SEO_TITULO
    if not pagina.seo_descripcion:
        pagina.seo_descripcion = SEO_DESCRIPCION
    pagina.save(update_fields=["seo_titulo", "seo_descripcion"])


def revertir(apps, schema_editor):
    # Mismo criterio que 0028/0030/0044/0046: volver atrás es "Restaurar versión".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0046_tienda_catalogo_de_compra"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
