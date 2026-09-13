"""
El Home de La Gran Cosecha pasa de catalogo a landing comercial B2B.

Sigue el mismo patron que `0024_home_gran_cosecha_rediseno`: solo escribe la
`Plantilla` de slug "la-gran-cosecha" (el molde, para una tienda nueva que la
adopte) y la `Pagina` "/" del tenant real "la-gran-cosecha". Ningun otro
tenant ni ninguna otra plantilla se lee ni se escribe.

# El cambio de fondo

El encargo pide que el Home deje de sentirse como "vendemos frutas y
verduras" y pase a comunicar "nos encargamos del abastecimiento de tu
negocio", con la jerarquia Descubrir -> Entender -> Confiar -> Desear ->
Comprar. Con el motor ya en pie desde `0024`, casi todo el trabajo es de
composicion y de copy, no de bloques nuevos:

    Hero (portada)              — titular reescrito al contraste
                                  problema/solucion que pide el encargo.
    Video (nuevo, ver 0027)     — el espacio publicitario que no existia.
    Propuesta de valor          — mismo `por-que-elegirnos` de siempre (los
    (por-que-elegirnos)           beneficios reales del negocio no se tocan,
                                  solo el titular de la seccion).
    Lo mas pedido                — mismo `productos-destacados`, con limite
    (productos-destacados)        bajo: la seccion es un gancho, no un
                                  segundo catalogo.
    Para tu negocio               — mismo `publicos-objetivo` que sembro
    (publicos-objetivo)           `0024`, ya alineado al encargo.
    Como funciona                — mismos `PASOS` que sembro `0024`.
    (como-funciona)
    Campana de temporada          — `banner-promocional` sin foto todavia
    (banner-promocional)          (no se inventa una): demuestra el
                                  componente listo para administrarse desde
                                  el panel, como pide el encargo.
    Testimonios                  — sin cambios: ya hay testimonios reales
                                  cargados para este negocio.
    Insignias de confianza        — sin cambios de props; el contenido real
    (insignias-confianza)         es el que quedo tras la migracion de
                                  limpieza de `content`.
    Cierre (cta-banda)            — la llamada final del encargo.

No se inventan cifras de negocio en ningun punto: donde el encargo pide
metricas (pedidos atendidos, negocios atendidos), se deja que el bloque de
insignias muestre lo que el propio negocio ya cargo, en vez de un numero
fabricado por esta migracion.

Tambien se completa el SEO de la pagina («/»), que estaba vacio: sin
`seo_titulo`/`seo_descripcion` propios, `generateMetadata` cae al nombre y a
la mision del negocio, que no mencionan lo que alguien buscaria en un
buscador («abastecimiento para restaurantes», «frutas y verduras para
negocios»).

# Por que no se intenta revertir la composicion

Mismo criterio que `0024`: revertir sobrescribiria en silencio cualquier
ajuste que el negocio haya hecho desde el panel despues de publicar este
cambio. `revertir()` no toca la composicion publicada; volver atras de verdad
se hace desde "Restaurar version" en el panel, donde la version anterior
sigue disponible (se archiva, no se borra).
"""
from django.db import migrations
from django.utils import timezone


PORTADA = {
    "kicker": "Abastecemos tu negocio",
    "titulo": "Tu negocio necesita productos.",
    "titulo_resaltado": "Nosotros nos encargamos del abastecimiento.",
    "texto": (
        "Frutas, verduras, tuberculos, granos y mas productos frescos, "
        "seleccionados y entregados directamente en tu negocio."
    ),
    "cta_texto": "Hacer mi pedido",
    "cta_href": "/tienda",
    "cta2_texto": "Explorar productos",
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

VIDEO = {
    "kicker": "Del abasto a tu negocio",
    "kicker_icono": "camion",
    "titulo": "",
    "texto": (
        "Nosotros hacemos el trabajo para que tu puedas concentrarte en tu "
        "negocio."
    ),
    "video_url": "",
    "poster_url": "",
    "cta_texto": "Explorar productos",
    "cta_href": "/tienda",
    "autoplay": True,
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

# --------------------------------------------------------------------------
# La composicion nueva, de arriba a abajo: Descubrir -> Entender -> Confiar ->
# Desear -> Comprar.
# --------------------------------------------------------------------------
HOME_LANDING = [
    {"tipo": "portada", "variante": "imagen", "props": PORTADA},
    {"tipo": "video", "variante": "horizontal", "props": VIDEO},
    {
        "tipo": "por-que-elegirnos",
        "variante": "rejilla",
        "props": {
            "kicker": "Como trabajamos",
            "titulo": "Tu administras tu negocio. Nosotros el abastecimiento.",
            "subtitulo": "",
        },
    },
    {
        "tipo": "productos-destacados",
        "variante": "rejilla",
        "props": {
            "kicker": "Los preferidos",
            "titulo": "Lo mas pedido",
            "subtitulo": "Productos que otros negocios ya estan comprando.",
            "limite": 4,
        },
    },
    {"tipo": "publicos-objetivo", "variante": "tarjetas", "props": PUBLICOS},
    {"tipo": "como-funciona", "variante": "linea", "props": PASOS},
    {
        "tipo": "banner-promocional",
        "variante": "partido",
        "props": {
            "kicker": "Temporada",
            "titulo": "Temporada de frutas frescas",
            "texto": "Haz tu pedido para esta semana y asegura tu abastecimiento.",
            "boton_texto": "Comprar ahora",
            "boton_href": "/tienda",
        },
    },
    {"tipo": "testimonios", "variante": "", "props": {}},
    {"tipo": "insignias-confianza", "variante": "franja", "props": {}},
    {
        "tipo": "cta-banda",
        "variante": "banda",
        "props": {
            "titulo": "¿Listo para simplificar el abastecimiento de tu negocio?",
            "texto": (
                "Realiza tu pedido y deja que nosotros nos encarguemos del resto."
            ),
            "boton_texto": "Hacer mi pedido",
            "boton_href": "/tienda",
        },
    },
]

SEO_TITULO = "La Gran Cosecha | Abastecimiento de productos frescos para negocios"
SEO_DESCRIPCION = (
    "Frutas, verduras y productos frescos para restaurantes, tiendas y "
    "negocios. Arma tu pedido en minutos y recibelo directo donde trabajas."
)

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"


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
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    composicion = componer(HOME_LANDING)

    # 1. El molde, para una tienda nueva que adopte "la-gran-cosecha".
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas["/"] = composicion
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    # 2. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina, _ = Pagina.objects.get_or_create(
        tenant=tenant,
        ruta="/",
        defaults={"titulo": "Inicio", "tipo": "HOME"},
    )
    if not pagina.seo_titulo and not pagina.seo_descripcion:
        pagina.seo_titulo = SEO_TITULO
        pagina.seo_descripcion = SEO_DESCRIPCION
        pagina.save(update_fields=["seo_titulo", "seo_descripcion"])

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
        nota="Landing comercial: hero repensado, video, y el catalogo baja a gancho.",
        fecha_publicacion=timezone.now(),
    )

    # El borrador que hubiera quedado a medias en el panel se descarta, igual
    # que hace 0024: seguir editando sobre una composicion que ya no es la
    # publicada confundiria a quien entre al editor despues de este cambio.
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    # Deliberadamente no hace nada: ver "Por que no se intenta revertir la
    # composicion" en el docstring del modulo.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0027_bloque_video"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
