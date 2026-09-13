"""
"Lo más pedido" deja de ser una rejilla de productos y pasa a ser el
carrusel de anuncios.

El encargo original de `0028` puso una rejilla de `productos-destacados`
justo debajo del video, pensada como gancho hacia la tienda. Un encargo
posterior pidió que ese hueco concreto dejara de sentirse como "otra fila de
catálogo" y pasara a ser un espacio de marketing —campañas rotativas, no
productos— y que el título de sección "Los preferidos / Lo más pedido"
desapareciera con él: el bloque nuevo lleva su propia insignia
("Oferta especial", etc.) y un `<h2>` encima sería un encabezado hablando de
otra cosa.

Esta migración no reescribe toda la composición desde cero como `0024`/`0028`:
lee la versión PUBLICADA actual, sustituye únicamente el bloque de tipo
`productos-destacados` que está inmediatamente bajo el video (variante
`rejilla`, el gancho — no toca la variante `carrusel` de "Compra rápida" si
la hubiera en otra página) por uno de tipo `anuncios-carrusel`, y deja todo lo
demás exactamente como esté. Es más seguro que recomponer entera: si alguien
ya ajustó otra sección desde el panel entre `0028` y hoy, ese ajuste
sobrevive.

Solo toca al tenant "la-gran-cosecha", igual que el resto de esta serie.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

ANUNCIOS_BLOQUE = {
    "tipo": "anuncios-carrusel",
    "variante": "",
    "props": {"autoplay": True, "segundos": 7},
}


def _reemplazar(composicion):
    """Cambia el primer `productos-destacados` (el gancho, no un carrusel de
    compra rápida) por el carrusel de anuncios. Deja todo lo demás igual."""
    nueva = []
    reemplazado = False
    for bloque in composicion:
        if not reemplazado and bloque.get("tipo") == "productos-destacados" and bloque.get("variante") != "carrusel":
            nueva.append(
                {
                    "id": bloque["id"],
                    "tipo": ANUNCIOS_BLOQUE["tipo"],
                    "variante": ANUNCIOS_BLOQUE["variante"],
                    "props": ANUNCIOS_BLOQUE["props"],
                    "visible": bloque.get("visible", {"movil": True, "tablet": True, "escritorio": True}),
                }
            )
            reemplazado = True
        else:
            nueva.append(bloque)
    return nueva, reemplazado


def aplicar(apps, schema_editor):
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 1. El molde.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        home = paginas.get("/")
        if home:
            nueva, cambiado = _reemplazar(home)
            if cambiado:
                paginas["/"] = nueva
                plantilla.paginas = paginas
                plantilla.save(update_fields=["paginas"])

    # 2. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    nueva_composicion, cambiado = _reemplazar(publicada.composicion)
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
        composicion=nueva_composicion,
        nota='"Lo más pedido" pasa de rejilla de productos a carrusel de anuncios.',
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    # Mismo criterio que `0024`/`0028`: no se deshace contenido publicado en
    # automático. Volver atrás de verdad es "Restaurar versión" en el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0029_bloque_anuncios_carrusel"),
        ("content", "0015_siembra_anuncios_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
