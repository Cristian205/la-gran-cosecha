"""
`separador` gana la variante «Onda orgánica» y La Gran Cosecha la estrena.

Catálogo de bloques: se añade la variante `onda` (componente `OndaOrganica`:
curva asimétrica en verde salvia con trazo fino y dos ramitos de línea). Es
una variante del separador de siempre, no un bloque nuevo: se coloca, mueve
o quita desde el constructor como cualquier otro separador.

La Gran Cosecha (y su plantilla), /tienda: una onda entre el banner de
«Los favoritos de los negocios» y las categorías, la transición del
escaparate al catálogo.

Como en 0061/0064-0066, lo publicado se archiva con una versión nueva y
cada paso comprueba antes de escribir.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"

VARIANTE_ONDA = {"codigo": "onda", "nombre": "Onda orgánica"}

BLOQUE_ONDA = {
    "id": "separador-onda-catalogo",
    "tipo": "separador",
    "variante": "onda",
    "props": {"espacio": 1},
    "visible": {"movil": True, "tablet": True, "escritorio": True},
}


def _catalogo(apps):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="separador").first()
    if bloque is None:
        return
    variantes = list(bloque.variantes or [])
    if any(isinstance(v, dict) and v.get("codigo") == "onda" for v in variantes):
        return
    variantes.append(VARIANTE_ONDA)
    bloque.variantes = variantes
    bloque.save(update_fields=["variantes"])


def _con_onda(composicion):
    if not isinstance(composicion, list):
        return None
    tipos = [b.get("tipo") if isinstance(b, dict) else None for b in composicion]
    if any(isinstance(b, dict) and b.get("id") == BLOQUE_ONDA["id"] for b in composicion):
        return None  # ya está
    if "favoritos-negocios" not in tipos:
        return None
    nueva = list(composicion)
    nueva.insert(tipos.index("favoritos-negocios") + 1, dict(BLOQUE_ONDA))
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
    _transformar(apps, _con_onda, "Onda orgánica entre los favoritos y el catálogo.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0066_favoritos_con_pedidos_anteriores")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
