"""
Corrige el orden del menú a Productos, Categorías, Para negocios, Contacto.

`0033_anclas_y_menu_tienda` insertaba los dos enlaces nuevos uno a uno en la
misma posición (índice 1), así que el segundo empujaba al primero: el menú
quedó "Productos, Para negocios, Categorías, Contacto" en vez del orden que
pedía el encargo. Se corrige por orden explícito, no insertando de nuevo.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
ORDEN = {"Productos": 0, "Categorías": 1, "Para negocios": 2, "Contacto": 3}


def aplicar(apps, schema_editor):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is None:
        return

    publicada = layout.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    cambiado = False
    nueva = []
    for bloque in publicada.composicion:
        if bloque.get("tipo") == "cabecera":
            props = dict(bloque.get("props", {}))
            enlaces = list(props.get("enlaces") or [])
            ordenados = sorted(enlaces, key=lambda e: ORDEN.get(e.get("texto"), 99))
            if ordenados != enlaces:
                props["enlaces"] = ordenados
                bloque = {**bloque, "props": props}
                cambiado = True
        nueva.append(bloque)

    if not cambiado:
        return

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
        nota="Orden del menú: Productos, Categorías, Para negocios, Contacto.",
        fecha_publicacion=timezone.now(),
    )
    layout.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0036_marquesina_en_home")]

    operations = [migrations.RunPython(aplicar, revertir)]
