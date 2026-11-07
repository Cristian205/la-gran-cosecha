"""
La Gran Cosecha (y su plantilla), /tienda: las categorías bajan junto al
catálogo.

    antes                         después
    ────────────────────────      ────────────────────────
    catalogo-hero                 catalogo-hero
    repetir-pedido                repetir-pedido
    categorias-navegacion   ──┐   favoritos-negocios
    favoritos-negocios        └─▶ categorias-navegacion
    catalogo-toolbar              catalogo-toolbar
    grid-productos                grid-productos

Las tarjetas de categorías son el filtro de la rejilla: quedan encima de la
barra del catálogo, pegadas a lo que filtran, y no entre el buscador y el
banner. Solo se mueve el bloque (mismo id, variante y propiedades); el
negocio puede volver a ordenarlo desde el constructor.

Como en 0061/0064, lo publicado se archiva con una versión nueva y cada paso
comprueba antes de escribir.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"


def _mover_categorias(composicion):
    if not isinstance(composicion, list):
        return None
    tipos = [b.get("tipo") if isinstance(b, dict) else None for b in composicion]
    if "categorias-navegacion" not in tipos or "catalogo-toolbar" not in tipos:
        return None
    i_cat = tipos.index("categorias-navegacion")
    i_bar = tipos.index("catalogo-toolbar")
    if i_cat == i_bar - 1:
        return None  # ya está justo encima de la barra
    nueva = list(composicion)
    bloque = nueva.pop(i_cat)
    i_bar = [b.get("tipo") if isinstance(b, dict) else None for b in nueva].index("catalogo-toolbar")
    nueva.insert(i_bar, bloque)
    return nueva


def _transformar(apps, transformar, nota):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Tenant = apps.get_model("tenancy", "Tenant")

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = transformar(paginas.get(RUTA))
        if nueva is not None:
            paginas[RUTA] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta=RUTA).first()
    if pagina is None:
        return

    for borrador in pagina.versiones.filter(estado="BORRADOR"):
        nueva = transformar(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    nueva = transformar(publicada.composicion)
    if nueva is None:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo_numero = pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )


def aplicar(apps, schema_editor):
    _transformar(apps, _mover_categorias, "Las categorías, justo encima del catálogo.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0064_hero_catalogo_movil_y_populares")]

    # Sin vuelta atrás propia: el orden se cambia desde el constructor.
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
