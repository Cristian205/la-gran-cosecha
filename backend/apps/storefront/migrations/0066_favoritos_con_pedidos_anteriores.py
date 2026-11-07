"""
«Para empezar tu pedido»: el banner del destacado y los pedidos anteriores,
en una sola sección.

Catálogo de bloques — `favoritos-negocios` gana (se AÑADEN al esquema):
- `mostrar_pedidos_anteriores`: el panel «¿Ya nos has pedido antes?» junto
  al banner (70/30). Es la lógica de `repetir-pedido`, sin cambios: por
  cédula lleva a «Mis pedidos»; por nombre repite el último pedido del
  navegador.
- `beneficios`: la lista bajo el panel (título, texto, icono). Vacía: no se
  muestra. Sin valor, el componente pone los tres del diseño acordado.

La Gran Cosecha (y su plantilla), /tienda: se retira el bloque suelto
`repetir-pedido` que iba encima de los favoritos — su función ya vive en el
panel. Se puede volver a poner desde el constructor.

Como en 0061/0064/0065, lo publicado se archiva con una versión nueva y
cada paso comprueba antes de escribir.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/tienda"

ICONOS = [
    ("hoja", "Hoja"),
    ("caja", "Caja"),
    ("tienda", "Tienda"),
    ("camion", "Camión"),
    ("reloj", "Reloj"),
    ("escudo", "Escudo"),
]

PROPS_NUEVAS = {
    "mostrar_pedidos_anteriores": {
        "tipo": "boolean",
        "titulo": "Panel «¿Ya nos has pedido antes?»",
        "ayuda": "Junto al banner: lleva a «Mis pedidos» (o repite el último pedido de este equipo).",
        "default": True,
    },
    "beneficios": {
        "tipo": "array",
        "titulo": "Beneficios bajo el panel",
        "ayuda": "Hasta tres. Vacío: el panel va sin beneficios.",
        "items": {
            "tipo": "object",
            "properties": {
                "icono": {
                    "tipo": "enum",
                    "titulo": "Icono",
                    "opciones": [c for c, _ in ICONOS],
                    "opciones_etiquetas": dict(ICONOS),
                    "default": "hoja",
                },
                "titulo": {"tipo": "string", "titulo": "Título"},
                "texto": {"tipo": "string", "titulo": "Texto"},
            },
        },
    },
}


def _catalogo(apps):
    Bloque = apps.get_model("storefront", "Bloque")
    bloque = Bloque.objects.filter(codigo="favoritos-negocios").first()
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


def _sin_repetir_suelto(composicion):
    if not isinstance(composicion, list):
        return None
    tipos = [b.get("tipo") if isinstance(b, dict) else None for b in composicion]
    # Solo si el panel lo reemplaza: con favoritos en la página.
    if "repetir-pedido" not in tipos or "favoritos-negocios" not in tipos:
        return None
    return [b for b in composicion if not (isinstance(b, dict) and b.get("tipo") == "repetir-pedido")]


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
    _transformar(
        apps,
        _sin_repetir_suelto,
        "Pedidos anteriores dentro de «Los favoritos de los negocios»; sin el bloque suelto.",
    )


class Migration(migrations.Migration):
    dependencies = [("storefront", "0065_categorias_junto_al_catalogo")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
