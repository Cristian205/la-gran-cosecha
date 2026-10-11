"""
La campaña para negocios gana el marco de hojas y un chip sobre cada foto.

# Qué añade a `campana-negocios`

    mostrar_marco          hojas y bejucos dorados en las cuatro esquinas
                           (`/img/home/marco/`), detrás del contenido.
    collage[].etiqueta     el chip sobre la foto: «Restaurantes», «Hoteles»…
    collage[].icono        su icono.

Las dos cosas vienen apagadas por defecto: ninguna otra tienda cambia.

# La Gran Cosecha

Se enciende el marco y cada foto del collage recibe su chip, reconociendo la
foto por su archivo (`hogar`, `chef`, `hotel`, `fruteria`, `entrega`). Una foto
que alguien ya cambió o etiquetó se respeta. Se aplica como la 0055: nueva
versión publicada (la anterior queda ARCHIVADA, «Restaurar versión» la
devuelve), el mismo bloque dentro del borrador si lo hay, y la plantilla.
"""
import copy

from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

ICONOS_CHIP = [
    ("casa", "Casa"),
    ("cubiertos", "Cubiertos"),
    ("cama", "Cama"),
    ("tienda", "Tienda"),
    ("cafe", "Café"),
    ("camion", "Camión"),
]

#: Chip de cada foto sembrada en la 0055, por el nombre de su archivo.
CHIPS = {
    "hogar": ("Para tu hogar", "casa"),
    "chef": ("Restaurantes", "cubiertos"),
    "hotel": ("Hoteles", "cama"),
    "fruteria": ("Fruvers y fruterías", "tienda"),
    "entrega": ("Abastecimiento y entrega", "camion"),
}


def _actualizar_esquema(esquema):
    esquema = copy.deepcopy(esquema or {})
    propiedades = esquema.setdefault("properties", {})
    propiedades.setdefault(
        "mostrar_marco",
        {
            "tipo": "boolean",
            "titulo": "Marco de hojas en las esquinas",
            "default": False,
            "ayuda": "Decoración de hojas y bejucos dorados, detrás del contenido.",
        },
    )
    collage = propiedades.get("collage")
    if isinstance(collage, dict):
        items = collage.setdefault("items", {"tipo": "object", "properties": {}})
        campos = items.setdefault("properties", {})
        campos.setdefault(
            "etiqueta",
            {"tipo": "string", "titulo": "Chip sobre la foto", "ayuda": "Ej. «Restaurantes». Vacío: sin chip."},
        )
        campos.setdefault(
            "icono",
            {
                "tipo": "enum",
                "titulo": "Icono del chip",
                "opciones": [c for c, _ in ICONOS_CHIP],
                "opciones_etiquetas": dict(ICONOS_CHIP),
                "default": "tienda",
            },
        )
    return esquema


def _con_marco(composicion):
    """La composición con marco y chips; None si no hay nada que hacer."""
    salida = copy.deepcopy(composicion or [])
    tocado = False
    for bloque in salida:
        if bloque.get("tipo") != "campana-negocios":
            continue
        props = bloque.setdefault("props", {})
        if not props.get("collage") or "mostrar_marco" in props:
            continue  # sin collage, o ya aplicada / decidida a mano
        props["mostrar_marco"] = True
        for foto in props["collage"]:
            archivo = str(foto.get("imagen", "")).rsplit("/", 1)[-1].split(".")[0]
            if archivo in CHIPS and not foto.get("etiqueta"):
                foto["etiqueta"], foto["icono"] = CHIPS[archivo]
        tocado = True
    return salida if tocado else None


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    bloque = Bloque.objects.filter(codigo="campana-negocios").first()
    if bloque is not None:
        bloque.esquema_props = _actualizar_esquema(bloque.esquema_props)
        bloque.save(update_fields=["esquema_props"])

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = _con_marco(paginas.get("/"))
        if nueva is not None:
            paginas["/"] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if pagina is None:
        return

    publicada = VersionPagina.objects.filter(pagina=pagina, estado="PUBLICADA").first()
    if publicada is not None:
        nueva = _con_marco(publicada.composicion)
        if nueva is not None:
            publicada.estado = "ARCHIVADA"
            publicada.save(update_fields=["estado"])
            ultimo = (
                VersionPagina.objects.filter(pagina=pagina).order_by("-numero").values_list("numero", flat=True).first()
                or 0
            )
            VersionPagina.objects.create(
                tenant=tenant,
                pagina=pagina,
                numero=ultimo + 1,
                estado="PUBLICADA",
                composicion=nueva,
                nota="Campaña para negocios: marco de hojas y chip de cliente en cada foto.",
                fecha_publicacion=timezone.now(),
            )

    for borrador in VersionPagina.objects.filter(pagina=pagina, estado="BORRADOR"):
        nueva = _con_marco(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])


def revertir(apps, schema_editor):
    # Como la 0055: volver atrás el contenido es «Restaurar versión».
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0055_negocios_collage")]

    operations = [migrations.RunPython(aplicar, revertir)]
