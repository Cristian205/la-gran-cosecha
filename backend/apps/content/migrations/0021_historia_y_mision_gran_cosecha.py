"""
Historia y misión de La Gran Cosecha.

`AboutPage` solo pinta esas secciones cuando `StoreSettings.historia` y
`.mision` no están vacíos (ver `frontend/tienda/src/paginas/AboutPage.tsx`):
hasta ahora ninguno de los dos tenía valor, así que "Nosotros" carecía de esa
parte pese a que el componente ya la soporta.

El texto no inventa hechos verificables (fecha de fundación, tamaño del
equipo, cifras): se apoya solo en lo que ya es público en el resto del sitio
—el modelo de "compramos en abastos para que tú no tengas que ir", Soacha
como base, los segmentos que atiende— igual que ya hace el resto de "Nosotros".
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"

HISTORIA = (
    "La Gran Cosecha nació de una idea simple: los restaurantes, tiendas y "
    "negocios de alimentos pierden tiempo y dinero cada vez que alguien tiene "
    "que ir en persona a comprar frutas, verduras y abarrotes en la plaza de "
    "abastos.\n\n"
    "Empezamos haciendo ese recorrido por ellos: madrugando, seleccionando "
    "producto por producto en los abastos de la región, y llevándolo directo "
    "a la puerta de cada negocio en Soacha y sus alrededores.\n\n"
    "Con el tiempo, ese servicio se convirtió en una operación completa de "
    "abastecimiento: hoy consolidamos pedidos de distintos negocios, elegimos "
    "lo mejor de cada categoría —frutas, verduras, tubérculos, granos y "
    "más— y entregamos con la puntualidad que un negocio que no puede parar "
    "necesita.\n\n"
    "Seguimos haciendo lo mismo que el primer día: ir nosotros al abasto, "
    "para que nuestros clientes no tengan que hacerlo."
)

MISION = (
    "Ser el aliado de abastecimiento de confianza para restaurantes, tiendas, "
    "fruterías, cafeterías y hoteles: seleccionar y entregar productos "
    "frescos con la calidad y la puntualidad que un negocio necesita, para "
    "que nuestros clientes puedan concentrarse en atender el suyo."
)


def aplicar(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(
        tenant=tenant, historia="", mision=""
    ).update(historia=HISTORIA, mision=MISION)


def revertir(apps, schema_editor):
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    StoreSettings.objects.filter(
        tenant=tenant, historia=HISTORIA, mision=MISION
    ).update(historia="", mision="")


class Migration(migrations.Migration):

    dependencies = [("content", "0020_ciudad_con_departamento_gran_cosecha")]

    operations = [migrations.RunPython(aplicar, revertir)]
