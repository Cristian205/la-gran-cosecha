"""
La Gran Cosecha, /nosotros: la primera escena de «Así funciona La Gran
Cosecha» («Todo comienza antes de que amanezca.») pasa del tono «noche» al
«claro» — el mismo crema cálido de la cabecera, con texto oscuro —, así la
cabecera y la primera escena se leen como una sola pieza clara.

Solo cambia ese `tono` (las demás escenas conservan el suyo); se edita desde
el constructor como cualquier otro. Lo publicado se archiva con una versión
nueva, como en 0067-0070.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/nosotros"


def _primera_clara(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "nosotros-proceso":
            props = dict(bloque.get("props") or {})
            escenas = [dict(e) for e in (props.get("escenas") or []) if isinstance(e, dict)]
            if escenas and escenas[0].get("tono") != "claro":
                escenas[0]["tono"] = "claro"
                bloque = {**bloque, "props": {**props, "escenas": escenas}}
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
    _transformar(apps, _primera_clara, "Proceso: la primera escena en tono claro.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0070_ondas_en_nosotros_y_contacto")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
