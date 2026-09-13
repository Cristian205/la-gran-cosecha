"""
Copy de "ayuda" del pie orientado a conversión, y SEO de "/tienda".

El pie ya tiene una sección de ayuda con enlace a WhatsApp; solo se actualiza
su texto al que pide el encargo ("¿Necesitas ayuda para abastecer tu
negocio?"), sin tocar el enlace ni el botón, que ya funcionan.

`seo_titulo`/`seo_descripcion` de "/tienda" estaban vacíos, así que
`generateMetadata` caía a "Catálogo" + una descripción genérica. Se completan
para posicionar la página como lo que es: un proveedor de productos frescos
para negocios, no un supermercado genérico.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"

AYUDA_TITULO = "¿Necesitas ayuda para abastecer tu negocio?"
AYUDA_TEXTO = "Nuestro equipo puede ayudarte a preparar tu pedido."

SEO_TITULO = "Catálogo | Frutas, verduras y más para tu negocio — La Gran Cosecha"
SEO_DESCRIPCION = (
    "Proveedor de productos frescos para negocios: frutas, verduras, "
    "tubérculos y granos con distintas presentaciones. Arma tu pedido en "
    "minutos y recíbelo donde trabajas."
)


def aplicar(apps, schema_editor):
    Pagina = apps.get_model("storefront", "Pagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is not None:
        publicada = layout.versiones.filter(estado="PUBLICADA").first()
        if publicada is not None:
            cambiado = False
            nueva = []
            for bloque in publicada.composicion:
                if bloque.get("tipo") == "pie":
                    props = dict(bloque.get("props", {}))
                    props["ayuda_titulo"] = AYUDA_TITULO
                    props["ayuda_texto"] = AYUDA_TEXTO
                    bloque = {**bloque, "props": props}
                    cambiado = True
                nueva.append(bloque)
            if cambiado:
                from django.utils import timezone  # noqa: PLC0415

                VersionPagina = apps.get_model("storefront", "VersionPagina")
                publicada.estado = "ARCHIVADA"
                publicada.save(update_fields=["estado"])
                ultimo_numero = (
                    layout.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
                )
                VersionPagina.objects.create(
                    tenant=tenant,
                    pagina=layout,
                    numero=ultimo_numero + 1,
                    estado="PUBLICADA",
                    composicion=nueva,
                    nota="Copy de ayuda del pie orientado a conversión.",
                    fecha_publicacion=timezone.now(),
                )
                layout.versiones.filter(estado="BORRADOR").delete()

    tienda = Pagina.objects.filter(tenant=tenant, ruta="/tienda").first()
    if tienda is not None and not tienda.seo_titulo and not tienda.seo_descripcion:
        tienda.seo_titulo = SEO_TITULO
        tienda.seo_descripcion = SEO_DESCRIPCION
        tienda.save(update_fields=["seo_titulo", "seo_descripcion"])


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0033_anclas_y_menu_tienda")]

    operations = [migrations.RunPython(aplicar, revertir)]
