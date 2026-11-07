"""
La Gran Cosecha, /tienda: una segunda onda orgánica, ahora ENCIMA de «Los
favoritos de los negocios» (entre el encabezado del catálogo y el banner).
Va en espejo para que no repita la curva de la de abajo: la sección queda
enmarcada por dos ondas que se responden.

Catálogo de bloques: `separador` gana `espejo` (solo lo usa la variante
«Onda orgánica»).

Como en 0067, lo publicado se archiva con una versión nueva y cada paso
comprueba antes de escribir.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"

PROP_ESPEJO = {
    "tipo": "boolean",
    "titulo": "Voltear la onda",
    "ayuda": "Solo en «Onda orgánica»: la curva en espejo, para alternarla entre secciones.",
    "default": False,
}

BLOQUE_ONDA = {
    "id": "separador-onda-favoritos",
    "tipo": "separador",
    "variante": "onda",
    "props": {"espacio": 1, "espejo": True},
    "visible": {"movil": True, "tablet": True, "escritorio": True},
}


def _catalogo(apps):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="separador").first()
    if bloque is None:
        return
    esquema = dict(bloque.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    if "espejo" in propiedades:
        return
    propiedades["espejo"] = PROP_ESPEJO
    esquema["properties"] = propiedades
    bloque.esquema_props = esquema
    bloque.save(update_fields=["esquema_props"])


def _con_onda_arriba(composicion):
    if not isinstance(composicion, list):
        return None
    if any(isinstance(b, dict) and b.get("id") == BLOQUE_ONDA["id"] for b in composicion):
        return None
    tipos = [b.get("tipo") if isinstance(b, dict) else None for b in composicion]
    if "favoritos-negocios" not in tipos:
        return None
    nueva = list(composicion)
    nueva.insert(tipos.index("favoritos-negocios"), dict(BLOQUE_ONDA))
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
    _catalogo(apps)
    _transformar(apps, _con_onda_arriba, "Onda orgánica también encima de los favoritos.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0067_separador_onda_organica")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
