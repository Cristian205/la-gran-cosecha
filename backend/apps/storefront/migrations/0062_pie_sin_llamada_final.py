"""
La Gran Cosecha (y su plantilla) quita del pie la franja «¿Listo para
abastecer tu negocio?» con «Hacer mi pedido» y WhatsApp.

No se borra nada: se apaga `mostrar_cta`, la opción «Mostrar la llamada
final» del bloque `pie`, que se vuelve a encender desde el panel. Los demás
negocios no cambian. Como en 0053, lo publicado se archiva con una versión
nueva.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/_layout"


def _con_cta(valor):
    def transformar(composicion):
        if not isinstance(composicion, list):
            return None
        cambiado = False
        nueva = []
        for bloque in composicion:
            if isinstance(bloque, dict) and bloque.get("tipo") == "pie":
                props = dict(bloque.get("props") or {})
                if props.get("mostrar_cta", True) != valor:
                    bloque = {**bloque, "props": {**props, "mostrar_cta": valor}}
                    cambiado = True
            nueva.append(bloque)
        return nueva if cambiado else None

    return transformar


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
    _transformar(apps, _con_cta(False), "Pie: sin la franja «¿Listo para abastecer tu negocio?».")


def revertir(apps, schema_editor):
    _transformar(apps, _con_cta(True), "Pie: vuelve la franja de llamada final.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0061_ajustes_cabecera_y_destacados")]

    operations = [migrations.RunPython(aplicar, revertir)]
