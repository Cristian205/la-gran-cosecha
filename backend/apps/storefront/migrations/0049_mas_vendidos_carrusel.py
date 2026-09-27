"""
"Producto estrella" pasa a ser el carrusel de los más vendidos.

El bloque `producto-spotlight` mostraba UN producto a pantalla completa (el
primero con foto del ranking) y los tres siguientes como enlaces. Ahora es un
carrusel de los primeros `cantidad` (5) del mismo ranking real
(`/orders/productos-mas-vendidos/`), cada uno con su puesto verdadero. Ver
`frontend/tienda/src/bloques/campanas/ProductSpotlight.tsx`.

# Qué cambia en la base

* El esquema del bloque gana `cantidad` e `intervalo` (editables en el panel)
  y su nombre y descripción dicen lo que ahora es.
* En el Home de La Gran Cosecha se quita `omitir: "mango"`. Existía para no
  repetir a pantalla completa la foto que abre el Home; en un carrusel de los
  más vendidos, saltarse uno haría que ya no fueran "los 5 más vendidos". El
  antetítulo pasa a "Los más vendidos de nuestro mercado".

# Reversible

La composición anterior queda ARCHIVADA ("Restaurar versión" en el panel).
El código anterior del bloque sigue siendo compatible con estas propiedades.
"""
import copy

from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
TIPO = "producto-spotlight"

KICKER = "Los más vendidos de nuestro mercado"


def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


ESQUEMA = {
    "tipo": "object",
    "properties": {
        "kicker": texto("Antetítulo", KICKER),
        "texto": texto("Texto", "Uno de los productos que más piden negocios como el tuyo."),
        "cta_texto": texto("Texto del botón", "Quiero este producto"),
        "cantidad": {
            "tipo": "number",
            "titulo": "Cuántos productos del ranking",
            "default": 5,
            "minimo": 1,
            "maximo": 8,
        },
        "intervalo": {
            "tipo": "number",
            "titulo": "Segundos por producto (avance automático)",
            "default": 7,
            "minimo": 4,
            "maximo": 20,
        },
        "omitir": texto(
            "No usar estos productos",
            ayuda="Slugs separados por coma. El puesto que se muestra sigue siendo el real del ranking.",
        ),
    },
}


def _nuevas_props(props):
    props = dict(props or {})
    props["omitir"] = ""
    props["kicker"] = KICKER
    props.setdefault("cantidad", 5)
    props.setdefault("intervalo", 7)
    return props


def _actualizar(composicion):
    nueva = copy.deepcopy(composicion or [])
    cambio = False
    for bloque in nueva:
        if bloque.get("tipo") == TIPO:
            bloque["props"] = _nuevas_props(bloque.get("props"))
            cambio = True
    return nueva, cambio


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    Bloque.objects.filter(codigo=TIPO).update(
        nombre="Más vendidos (carrusel)",
        descripcion="Los más vendidos del ranking real, uno por diapositiva: foto enorme, puesto, precio y una acción.",
        esquema_props=ESQUEMA,
    )

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None and "/" in (plantilla.paginas or {}):
        paginas = dict(plantilla.paginas)
        paginas["/"], _ = _actualizar(paginas["/"])
        plantilla.paginas = paginas
        plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    home = Pagina.objects.filter(tenant=tenant, ruta="/").first() if tenant else None
    if home is None:
        return
    publicada = home.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    composicion, cambio = _actualizar(publicada.composicion)
    if not cambio or composicion == publicada.composicion:
        return  # sin el bloque, o ya aplicada

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo = home.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=home,
        numero=ultimo + 1,
        estado="PUBLICADA",
        composicion=composicion,
        nota="Los más vendidos pasan a carrusel (5, sin omitir ninguno).",
        fecha_publicacion=timezone.now(),
    )
    # Un borrador a medio editar no se borra: recibe el mismo cambio, para que
    # publicarlo después no devuelva el `omitir` viejo. Y se renumera DETRÁS
    # de la versión recién publicada: el sistema supone que el borrador es
    # siempre la versión más reciente, y un borrador con número menor que la
    # publicada dejaba el siguiente número chocando con una archivada.
    for borrador in home.versiones.filter(estado="BORRADOR"):
        borrador.composicion, _ = _actualizar(borrador.composicion)
        borrador.numero = ultimo + 2
        borrador.save(update_fields=["composicion", "numero"])


def revertir(apps, schema_editor):
    # Mismo criterio que 0046–0048: volver atrás es "Restaurar versión".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0048_contacto_conversion"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
