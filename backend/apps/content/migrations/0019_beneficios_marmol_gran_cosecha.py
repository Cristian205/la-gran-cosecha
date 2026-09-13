"""
Los 4 beneficios de "Cómo trabajamos" (variante mármol) de La Gran Cosecha.

Solo toca los datos de este tenant — es contenido suyo, no una migración de
esquema. La fila que ya existía ("Frescura Garantizada") se actualiza en vez
de duplicarse; las otras tres se crean.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"

BENEFICIOS = [
    {
        "orden": 1,
        "icono": "basket",
        "titulo": "Frescura Garantizada",
        "texto": "Frutas y verduras frescas y de buena calidad, seleccionadas a mano.",
    },
    {
        "orden": 2,
        "icono": "package",
        "titulo": "Todo en un solo pedido",
        "texto": "Encuentra todas las categorías de productos en un solo lugar, simplificando tu compra.",
    },
    {
        "orden": 3,
        "icono": "shield",
        "titulo": "Proveedor de confianza",
        "texto": "Una solución fiable y constante para clientes que necesitan abastecerse de forma segura.",
    },
    {
        "orden": 4,
        "icono": "truck",
        "titulo": "Ahorra tiempo",
        "texto": "Realiza tu pedido de manera rápida y organizada, sin desplazamientos ni esperas innecesarias.",
    },
]


def aplicar(apps, schema_editor):
    BeneficioComercial = apps.get_model("content", "BeneficioComercial")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    for datos in BENEFICIOS:
        BeneficioComercial.objects.update_or_create(
            tenant=tenant, orden=datos["orden"], defaults=datos
        )


def revertir(apps, schema_editor):
    # No se borra contenido en automático: si esto se revierte, las filas se
    # quedan y alguien las ajusta a mano desde el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [("content", "0018_beneficio_icono_canasta")]

    operations = [migrations.RunPython(aplicar, revertir)]
