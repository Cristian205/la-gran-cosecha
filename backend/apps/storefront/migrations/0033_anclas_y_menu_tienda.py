"""
Anclas para "Categorías" y "Para negocios", y esos dos enlaces en el menú.

`grid-productos` ya tenía su "#catalogo" desde `0032` (el CTA del hero
apuntaba ahí desde antes sin que nada respondiera). Esta migración completa
el mismo gesto para las otras dos secciones nuevas de "/tienda"
(`categorias-destacadas`, `publicos-objetivo`) y añade los enlaces
correspondientes al menú de cabecera, que el propio negocio había dejado
reducido a "Productos" y "Contacto" — se AÑADEN los dos que faltan, no se
reemplaza lo que ya eligió tener.

Solo toca "/tienda" y "/_layout" del tenant "la-gran-cosecha".
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

NUEVOS_ENLACES = [
    {"texto": "Categorías", "href": "/tienda#categorias", "exacto": False},
    {"texto": "Para negocios", "href": "/tienda#para-negocios", "exacto": False},
]


def _publicar(pagina_model, version_model, pagina, nueva_composicion, nota):
    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])

    ultimo_numero = (
        pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    )
    version_model.objects.create(
        tenant=pagina.tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva_composicion,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def aplicar(apps, schema_editor):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    # 1. Las anclas en "/tienda".
    tienda = Pagina.objects.filter(tenant=tenant, ruta="/tienda").first()
    if tienda is not None:
        publicada = tienda.versiones.filter(estado="PUBLICADA").first()
        if publicada is not None:
            nueva = []
            for bloque in publicada.composicion:
                if bloque.get("tipo") == "categorias-destacadas":
                    bloque = {**bloque, "props": {**bloque.get("props", {}), "id": "categorias"}}
                elif bloque.get("tipo") == "publicos-objetivo":
                    bloque = {**bloque, "props": {**bloque.get("props", {}), "id": "para-negocios"}}
                nueva.append(bloque)
            _publicar(Pagina, VersionPagina, tienda, nueva, "Anclas para Categorías y Para negocios.")

    # 2. Los enlaces en "/_layout".
    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is not None:
        publicada = layout.versiones.filter(estado="PUBLICADA").first()
        if publicada is not None:
            nueva = []
            for bloque in publicada.composicion:
                if bloque.get("tipo") == "cabecera":
                    props = dict(bloque.get("props", {}))
                    enlaces = list(props.get("enlaces") or [])
                    existentes = {(e.get("texto"), e.get("href")) for e in enlaces}
                    # Se insertan después de "Productos" (posición 0) y antes
                    # de lo que siga, para que el orden visual sea Productos ->
                    # Categorías -> Para negocios -> el resto que ya hubiera.
                    for nuevo in NUEVOS_ENLACES:
                        if (nuevo["texto"], nuevo["href"]) not in existentes:
                            enlaces.insert(min(1, len(enlaces)), nuevo)
                    props["enlaces"] = enlaces
                    bloque = {**bloque, "props": props}
                nueva.append(bloque)
            _publicar(Pagina, VersionPagina, layout, nueva, "Menú: se añaden Categorías y Para negocios.")


def revertir(apps, schema_editor):
    # No se deshace contenido publicado en automático (mismo criterio que
    # 0030/0032): "Restaurar versión" en el panel es el camino real.
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0032_tienda_landing_comercial")]

    operations = [migrations.RunPython(aplicar, revertir)]
