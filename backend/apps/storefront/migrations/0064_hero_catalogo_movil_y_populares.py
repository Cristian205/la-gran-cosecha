"""
Encabezado del catálogo (`catalogo-hero`): foto en el móvil y sugerencias
de lo más pedido.

Catálogo de bloques — se AÑADEN al esquema (no se reescribe nada):
- `imagen_movil`: una versión liviana de la foto para el teléfono. Vacía,
  el móvil sigue sin foto, como hasta ahora (la de escritorio pesa
  demasiado para una pantalla chica).
- `mostrar_populares`: atajos y sugerencias de lo más pedido en el buscador
  (el mismo ranking de ventas de «Los favoritos de los negocios»).

La Gran Cosecha (y su plantilla), página /tienda:
- `imagen_movil`: /img/home/abastecimiento-movil.webp — el mismo camión con
  sus productos, 560 px y 28 KB (la de escritorio: 183 KB).
- Una bajada más corta.

Como en 0061, lo publicado se archiva con una versión nueva y cada paso
comprueba antes de escribir.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"

PROPS_NUEVAS = {
    "imagen_movil": {
        "tipo": "string",
        "titulo": "Imagen para móvil (opcional)",
        "ayuda": "Una versión liviana de la imagen (unos 560 px de ancho). Vacía: en el móvil no se muestra imagen.",
        "formato": "imagen",
    },
    "mostrar_populares": {
        "tipo": "boolean",
        "titulo": "Sugerir lo más pedido en el buscador",
        "ayuda": "Al tocar el buscador vacío y como atajos bajo él, según el ranking real de ventas.",
        "default": True,
    },
}

CAMBIOS_LGC = {
    "imagen_movil": "/img/home/abastecimiento-movil.webp",
    "texto": "Frutas, verduras, tubérculos y granos para tu negocio, en un solo pedido.",
}
TEXTO_ANTERIOR = "Frutas, verduras, tubérculos, granos y más. Elige, agrega y arma tu pedido en minutos."


def _catalogo(apps):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="catalogo-hero").first()
    if bloque is None:
        return
    esquema = dict(bloque.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    cambiado = False
    for clave, campo in PROPS_NUEVAS.items():
        if clave not in propiedades:
            propiedades[clave] = campo
            cambiado = True
    if cambiado:
        esquema["properties"] = propiedades
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


def _hero(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "catalogo-hero":
            props = dict(bloque.get("props") or {})
            cambios = {}
            if not props.get("imagen_movil") and props.get("imagen") == "/img/home/abastecimiento.webp":
                cambios["imagen_movil"] = CAMBIOS_LGC["imagen_movil"]
            # Solo si el negocio no la reescribió: la suya manda.
            if props.get("texto") == TEXTO_ANTERIOR:
                cambios["texto"] = CAMBIOS_LGC["texto"]
            if cambios:
                bloque = {**bloque, "props": {**props, **cambios}}
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
    _catalogo(apps)
    _transformar(apps, _hero, "Encabezado del catálogo: imagen para móvil y bajada más corta.")


class Migration(migrations.Migration):
    dependencies = [("storefront", "0063_favoritos_banner_campana")]

    # Solo añade campos y valores; revertir no los quita (no estorban).
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
