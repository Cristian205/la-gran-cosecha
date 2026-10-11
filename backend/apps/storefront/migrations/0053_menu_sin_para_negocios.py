"""
Quita «Para negocios» del menú de la cabecera de La Gran Cosecha.

Apuntaba a `/#negocios`, la campaña para negocios del propio Inicio: un
enlace del menú principal que lleva a media página de Inicio compite con
«Inicio» y hace parecer que hay una sección que no existe. La campaña sigue
en el Inicio con su ancla, y el pie conserva su enlace.

Como en 0052: si hay un borrador del armazón, recibe el mismo cambio en vez
de borrarse (puede tener trabajo del negocio a medio hacer); lo publicado se
archiva y se publica una versión nueva, que queda en el historial del editor.
La plantilla «La Gran Cosecha» se corrige igual, para que adoptarla de nuevo
no lo devuelva.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
TEXTO = "Para negocios"
ENLACE = {"href": "/#negocios", "texto": TEXTO, "exacto": False}


def _es_el_enlace(e) -> bool:
    return isinstance(e, dict) and (e.get("texto") or "").strip().lower() == TEXTO.lower()


def _sin_enlace(composicion):
    """La composición sin el enlace en la cabecera, o None si no lo tenía."""
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera":
            props = dict(bloque.get("props") or {})
            enlaces = props.get("enlaces") or []
            filtrados = [e for e in enlaces if not _es_el_enlace(e)]
            if len(filtrados) != len(enlaces):
                bloque = {**bloque, "props": {**props, "enlaces": filtrados}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _con_enlace(composicion):
    """Lo contrario, para revertir: lo vuelve a poner tras «Tienda»."""
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera":
            props = dict(bloque.get("props") or {})
            enlaces = list(props.get("enlaces") or [])
            if not any(_es_el_enlace(e) for e in enlaces):
                pos = next((i + 1 for i, e in enumerate(enlaces) if (e.get("texto") or "") == "Tienda"), len(enlaces))
                enlaces.insert(pos, dict(ENLACE))
                bloque = {**bloque, "props": {**props, "enlaces": enlaces}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _transformar(apps, transformar, nota):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Tenant = apps.get_model("tenancy", "Tenant")

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = transformar(paginas.get("/_layout"))
        if nueva is not None:
            paginas["/_layout"] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is None:
        return

    for borrador in layout.versiones.filter(estado="BORRADOR"):
        nueva = transformar(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])

    publicada = layout.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    nueva = transformar(publicada.composicion)
    if nueva is None:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo_numero = layout.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=layout,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )


def aplicar(apps, schema_editor):
    _transformar(apps, _sin_enlace, "Menú: se quita «Para negocios» (la campaña ya está en el Inicio).")


def revertir(apps, schema_editor):
    _transformar(apps, _con_enlace, "Menú: vuelve «Para negocios».")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0052_pie_firma_y_grupos_legales")]

    operations = [migrations.RunPython(aplicar, revertir)]
