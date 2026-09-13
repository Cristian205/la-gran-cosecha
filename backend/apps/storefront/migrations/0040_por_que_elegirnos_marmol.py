"""
La variante «Mármol» de «Por qué elegirnos», y su copy en el Home de
La Gran Cosecha.

Encabezado centrado en serif sobre mármol, tarjetas elevadas — ver
`componentes/PorQueElegirnos.tsx` y las reglas `.pqe-marmol*` en
`global.css`. Registra la variante para cualquier tienda del motor y, además,
la activa en el Home de La Gran Cosecha con su propio kicker/título (el
contenido de las tarjetas lo trae `content.BeneficioComercial`, ver
`0019_beneficios_marmol_gran_cosecha` en la app `content`).
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

VARIANTES_ANTES = [
    {"codigo": "rejilla", "nombre": "Rejilla"},
    {"codigo": "lista", "nombre": "Lista compacta"},
]

VARIANTES_AHORA = VARIANTES_ANTES + [
    {"codigo": "marmol", "nombre": "Mármol"},
]

KICKER = "Cómo trabajamos"
TITULO = "Tú administras tu negocio. Nosotros el abastecimiento."


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="por-que-elegirnos").update(variantes=VARIANTES_AHORA)

    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    cambiado = False
    nueva = []
    for bloque in publicada.composicion:
        if bloque.get("tipo") == "por-que-elegirnos":
            props = {**bloque.get("props", {}), "kicker": KICKER, "titulo": TITULO}
            bloque = {**bloque, "props": props, "variante": "marmol"}
            cambiado = True
        nueva.append(bloque)

    if not cambiado:
        return

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
        composicion=nueva,
        nota="Por qué elegirnos: variante Mármol, con su título editorial.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="por-que-elegirnos").update(variantes=VARIANTES_ANTES)
    # El contenido publicado no se deshace en automático (mismo criterio que
    # el resto de migraciones de contenido): "Restaurar versión" en el panel.


class Migration(migrations.Migration):

    dependencies = [("storefront", "0039_separador_ornamento")]

    operations = [migrations.RunPython(aplicar, revertir)]
