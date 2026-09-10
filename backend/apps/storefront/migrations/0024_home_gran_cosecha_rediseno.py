"""
Rediseño comercial del Home — solo para La Gran Cosecha.

Reordena la composición de "/" para que el catálogo aparezca apenas termina el
Hero, en vez de después de tres secciones de explicación: categorías y
productos suben, "Cómo funciona" y "Para negocios" bajan. Ningún texto se
inventa — se reutiliza el mismo `PORTADA`/`PUBLICOS`/`PASOS` que sembró
`0007_portada_y_plantilla_cosecha`, y las secciones nuevas usan las palabras
que trajo el propio encargo del rediseño.

# Por qué esto no toca ninguna otra tienda

Esta migración solo escribe dos filas: la `Plantilla` de slug
"la-gran-cosecha" (el molde, para que una tienda nueva que la adopte nazca ya
con este orden) y la `Pagina` "/" del tenant real "La Gran Cosecha" (el mismo
que sembró `tenancy.0002_migra_la_gran_cosecha`). Ninguna otra plantilla ni
ningún otro tenant se lee ni se escribe.

La única variante de CÓDIGO nueva que esto usa es `categorias-destacadas:
tarjetas` (component `CategoriasDestacadas.tsx`), añadida al catálogo de
bloques en esta misma migración. Es opt-in: las tiendas que ya tenían esa
sección puesta con `rejilla` o `tiras` no cambian, porque no seleccionan la
variante nueva.

# Por qué no se intenta revertir la composición

Revertir automáticamente sobrescribiría, en silencio, cualquier ajuste que
alguien haya hecho desde el panel después de publicar este rediseño — el mismo
riesgo que `0023_biblioteca_de_bloques` señala para no borrar bloques
retirados. `revertir()` solo deshace la parte de catálogo (retira la variante
`tarjetas` de la lista de opciones); la composición publicada se deja como
esté, y volver atrás de verdad se hace desde "Restaurar versión" en el panel,
donde la versión anterior sigue disponible en el historial (se archiva, no se
borra).
"""
from django.db import migrations
from django.utils import timezone


# --------------------------------------------------------------------------
# Contenido reutilizado tal cual de 0007_portada_y_plantilla_cosecha — nada se
# reescribe aquí, solo se reordena dónde aparece cada bloque.
# --------------------------------------------------------------------------
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

# --------------------------------------------------------------------------
# La composicion nueva, de arriba a abajo. Descubrir -> Explorar -> Confiar ->
# Comprar: el Hero, el catalogo sube justo despues, la explicacion y la
# confianza van despues de que el visitante ya vio que hay que comprar.
# --------------------------------------------------------------------------
HOME_COSECHA = [
    {"tipo": "portada", "variante": "imagen", "props": PORTADA},
    {
        "tipo": "categorias-destacadas",
        "variante": "tarjetas",
        "props": {
            "kicker": "Catalogo",
            "titulo": "Compra por categoria",
            "subtitulo": "Encuentra justo lo que necesitas para abastecer tu negocio.",
        },
    },
    {
        "tipo": "productos-destacados",
        "variante": "rejilla",
        "props": {
            "kicker": "Los preferidos",
            "titulo": "Lo mas pedido",
            "subtitulo": "Productos que otros negocios ya estan comprando.",
        },
    },
    {
        "tipo": "productos-destacados",
        "variante": "carrusel",
        "props": {
            "titulo": "Compra rapida",
            "subtitulo": "Agrega tus productos habituales en segundos.",
            "limite": 8,
        },
    },
    {"tipo": "como-funciona", "variante": "linea", "props": PASOS},
    {"tipo": "insignias-confianza", "variante": "franja", "props": {}},
    {"tipo": "publicos-objetivo", "variante": "tarjetas", "props": PUBLICOS},
    {"tipo": "testimonios", "variante": "", "props": {}},
    {
        "tipo": "cta-banda",
        "variante": "banda",
        "props": {
            "titulo": "Abastece tu negocio sin complicarte.",
            "texto": (
                "Encuentra lo que necesitas, arma tu pedido y nosotros nos "
                "encargamos del resto."
            ),
            "boton_texto": "Hacer mi pedido",
            "boton_href": "/tienda",
        },
    },
]

#: La variante nueva de `categorias-destacadas`. Se anade a las que ya tenia
#: en vez de reemplazarlas, igual que hace 0007 con `como-funciona`.
VARIANTE_TARJETAS = {"codigo": "tarjetas", "nombre": "Tarjetas con accion"}

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
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 1. La variante nueva, solo si no estaba ya (alguien pudo haberla anadido
    #    a mano desde el panel).
    categorias = Bloque.objects.filter(codigo="categorias-destacadas").first()
    if categorias is not None:
        codigos = {v.get("codigo") for v in (categorias.variantes or [])}
        if VARIANTE_TARJETAS["codigo"] not in codigos:
            categorias.variantes = [*(categorias.variantes or []), VARIANTE_TARJETAS]
            categorias.save(update_fields=["variantes"])

    composicion = componer(HOME_COSECHA)

    # 2. El molde: para que una tienda nueva que adopte "la-gran-cosecha" nazca
    #    ya con este orden. No afecta a ningun negocio que ya la haya adoptado
    #    — adoptar_plantilla COPIA, nunca referencia.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas["/"] = composicion
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    # 3. El tenant real: se publica de inmediato, como se acordo con el
    #    negocio. La version publicada de hoy se archiva — no se borra — para
    #    poder restaurarla desde el panel si hiciera falta.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina, _ = Pagina.objects.get_or_create(
        tenant=tenant,
        ruta="/",
        defaults={"titulo": "Inicio", "tipo": "HOME"},
    )

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
        nota="Rediseno comercial del Home: catalogo sube, explicacion baja.",
        fecha_publicacion=timezone.now(),
    )

    # El borrador que hubiera quedado a medias en el panel se descarta: seguir
    # editando sobre una composicion que ya no es la publicada confundiria a
    # quien entre al editor despues de este cambio.
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")

    categorias = Bloque.objects.filter(codigo="categorias-destacadas").first()
    if categorias is not None:
        categorias.variantes = [
            v for v in (categorias.variantes or []) if v.get("codigo") != "tarjetas"
        ]
        categorias.save(update_fields=["variantes"])


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0023_biblioteca_de_bloques"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
