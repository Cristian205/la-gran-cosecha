"""
Los primeros cuatro anuncios de La Gran Cosecha.

Son literalmente los cuatro ejemplos de campaña que trajo el encargo del
carrusel de anuncios — no se inventa copy nuevo, se carga el que ya se
aprobó. Sin foto todavía: ninguna de las cuatro tiene una fotografía real
subida, así que se deja en blanco a propósito y el componente
(`AnunciosCarrusel.tsx`) ya sabe pintarse sin ella con un marcador de
posición de la identidad de la marca, en vez de con una imagen de banco
fabricada por esta migración.

Solo toca al tenant "la-gran-cosecha", igual que el resto de migraciones de
contenido de este rediseño.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"

ANUNCIOS = [
    {
        "etiqueta": "Oferta especial",
        "titulo": "Frutas y verduras de la mejor calidad",
        "texto": "Directo del campo a tu negocio. Frescura, calidad y los mejores precios.",
        "cta_texto": "Ver productos",
        "cta_href": "/tienda",
        "orden": 0,
    },
    {
        "etiqueta": "Abastecimiento",
        "titulo": "Abastece tu negocio fácilmente",
        "texto": "Encuentra todo lo que necesitas en un solo lugar.",
        "cta_texto": "Comprar ahora",
        "cta_href": "/tienda",
        "orden": 1,
    },
    {
        "etiqueta": "Calidad seleccionada",
        "titulo": "Productos frescos para tu negocio",
        "texto": "Calidad seleccionada para restaurantes, tiendas y negocios.",
        "cta_texto": "Explorar catálogo",
        "cta_href": "/tienda",
        "orden": 2,
    },
    {
        "etiqueta": "Por volumen",
        "titulo": "Precios especiales por volumen",
        "texto": "Compra para tu negocio y encuentra excelentes precios.",
        "cta_texto": "Ver ofertas",
        "cta_href": "/tienda",
        "orden": 3,
    },
]


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Anuncio = apps.get_model("content", "Anuncio")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    if Anuncio.objects.filter(tenant=tenant).exists():
        return

    for datos in ANUNCIOS:
        Anuncio.objects.create(tenant=tenant, activo=True, **datos)


def revertir(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Anuncio = apps.get_model("content", "Anuncio")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    Anuncio.objects.filter(
        tenant=tenant, titulo__in=[a["titulo"] for a in ANUNCIOS]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0014_row_level_security_anuncio"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
