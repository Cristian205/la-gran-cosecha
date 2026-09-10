"""
La página "no encontrada", como una composición más — no un mensaje a fuego.

`app/[ruta]/not-found.tsx` (frontend) ya sabía pintar un mensaje genérico
cuando una ruta no tiene composición; lo que faltaba era el bloque que un
negocio pudiera editar para que ese momento —llegar a un enlace roto— se
sintiera parte de su tienda y no un error técnico. `error-404` es ese bloque:
genérico, con su número, su título, su imagen y sus "ventajas" como props —
exactamente el mismo reparto contenido/diseño que ya usa `portada`.

Esta migración lo da de alta y compone, como primer caso de uso, la ruta
reservada `/_no-encontrada` (mismo criterio que `/_layout`: no se visita
directamente, la sirve `not-found.tsx`) para La Gran Cosecha — con la
ilustración que el propio negocio ya tenía subida a su biblioteca de medios,
no un archivo nuevo empaquetado con el código. Cambiarla mañana es una edición
en el panel, no un despliegue.
"""
from django.db import migrations
from django.utils import timezone


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


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


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

VENTAJA_ITEM = objeto(
    titulo=texto("Título"),
    texto=texto("Texto"),
    icono=texto("Ícono", "hoja"),
)

BLOQUE_ERROR_404 = {
    "nombre": "Página no encontrada",
    "descripcion": "Lo que se ve cuando una ruta de la tienda no existe. Va en la página reservada «/_no-encontrada».",
    "categoria": "ESTRUCTURA",
    "icono": "search-x",
    "esquema_props": objeto(
        kicker=texto("Antetítulo", "Página no encontrada"),
        numero=texto("Número", "404"),
        titulo=texto("Título"),
        texto=texto("Texto"),
        cta_texto=texto("Botón principal"),
        cta_href=texto("Enlace del botón principal", "/"),
        cta2_texto=texto("Enlace secundario"),
        cta2_href=texto("Destino del enlace secundario", "/tienda"),
        imagen=texto("Imagen (URL)"),
        imagen_alt=texto("Texto alternativo de la imagen"),
        mostrar_ventajas=bandera("Mostrar la franja de ventajas", True),
        ventajas={"tipo": "array", "titulo": "Ventajas", "items": VENTAJA_ITEM},
    ),
    "variantes": [{"codigo": "ilustrada", "nombre": "Ilustrada"}],
    "tokens_admitidos": BASE,
    "unico_por_pagina": True,
    "a_sangre": False,
    "requiere_datos": False,
    "orden": 5,
}

# --------------------------------------------------------------------------
# La composición de La Gran Cosecha
# --------------------------------------------------------------------------
IMAGEN_ILUSTRACION = (
    "https://pub-d9ed2b3f0c8c4677a9b68b7dcf17e565.r2.dev/media/"
    "tenants/f7ab4600-83cb-42ab-b17a-d694532d8b71/biblioteca/2026/09/"
    "13e75ef7fd3a49e2b6229892_K7TEKqP.png"
)

# Las mismas cuatro ventajas que ya usa `portada` (mismos títulos, mismos
# íconos): no se inventan datos nuevos, se reutiliza lo que el negocio ya
# tiene puesto en su Hero, con el texto de apoyo que pidió el encargo.
ERROR_404_PROPS = {
    "kicker": "Página no encontrada",
    "numero": "404",
    "titulo": "Ups... parece que esta cosecha se perdió.",
    "texto": (
        "La página que buscas no está disponible o fue movida. Pero no te "
        "preocupes, en La Gran Cosecha siempre tenemos algo fresco para ti."
    ),
    "cta_texto": "Volver al inicio",
    "cta_href": "/",
    "cta2_texto": "Explorar productos",
    "cta2_href": "/tienda",
    "imagen": IMAGEN_ILUSTRACION,
    "imagen_alt": "Camión de reparto de La Gran Cosecha junto a cajas de frutas y verduras frescas",
    "mostrar_ventajas": True,
    "ventajas": [
        {"titulo": "Productos frescos", "texto": "Siempre de la mejor calidad.", "icono": "hoja"},
        {"titulo": "Calidad garantizada", "texto": "Lo que tu negocio necesita.", "icono": "escudo"},
        {"titulo": "Entregas puntuales", "texto": "Directas a tu negocio.", "icono": "camion"},
        {"titulo": "Atención personalizada", "texto": "Estamos para ayudarte.", "icono": "soporte"},
    ],
}

COMPOSICION_NO_ENCONTRADA = [
    {"tipo": "error-404", "variante": "ilustrada", "props": ERROR_404_PROPS},
]

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/_no-encontrada"


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

    Bloque.objects.update_or_create(codigo="error-404", defaults=BLOQUE_ERROR_404)

    composicion = componer(COMPOSICION_NO_ENCONTRADA)

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        paginas[RUTA] = composicion
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina, _ = Pagina.objects.get_or_create(
        tenant=tenant,
        ruta=RUTA,
        defaults={"titulo": "Página no encontrada", "tipo": "LIBRE"},
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
        nota="La página de error usa ahora la ilustración de marca.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    """
    Mismo criterio que las migraciones de composición anteriores: no se
    reconstruye la página anterior (aquí ni existía), solo se archiva el
    bloque para que deje de ofrecerse — la composición publicada, si alguien
    la tocó después, se conserva en su historial y se restaura desde el panel.
    """
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="error-404").update(activo=False)


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0025_catalogo_como_bloques"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
