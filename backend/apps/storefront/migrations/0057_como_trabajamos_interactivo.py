"""
«Cómo trabajamos» (`historia-marca`) pasa de escenario con scroll a narrativa
interactiva de cuatro escenas.

# Esquema

Cada capítulo gana `imagen_movil` (foto vertical para teléfonos),
`enfoque_movil` y `alt` (el texto alternativo de su foto, que ahora sí se lee:
la foto es el contenido de la escena). El bloque gana `intervalo`, los segundos
por escena del avance automático (0 lo apaga).

# La Gran Cosecha

Los títulos y textos de las cuatro etapas pasan a los del nuevo guion. Las
fotos NO se tocan aquí: se conservan las actuales hasta sustituirlas por las de
cada escena. Se aplica como la 0055/0056: nueva versión publicada (la anterior
queda ARCHIVADA), el mismo bloque dentro del borrador si lo hay, y la
plantilla. Un capítulo que alguien ya reescribió a mano no se pisa: solo se
cambian los que aún dicen el texto anterior.
"""
import copy

from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

CAMPOS_CAPITULO = {
    "imagen_movil": {
        "tipo": "string",
        "titulo": "Foto para móvil (opcional)",
        "formato": "imagen",
        "ayuda": "Vertical. Vacía: se usa la principal.",
    },
    "enfoque_movil": {"tipo": "string", "titulo": "Encuadre en móvil"},
    "alt": {"tipo": "string", "titulo": "Texto alternativo de la foto"},
}

INTERVALO = {
    "tipo": "number",
    "titulo": "Segundos por etapa (avance automático)",
    "default": 7,
    "minimo": 0,
    "maximo": 15,
    "ayuda": "0 lo apaga. Se detiene en cuanto el visitante elige una etapa.",
}

#: Por etiqueta: (títulos anteriores que se pueden sustituir, título, texto).
GUION = {
    "El campo": (
        {"Todo empieza en el campo colombiano."},
        "Todo empieza en el campo colombiano.",
        "De la tierra nace la variedad de productos que llega a tu mesa.",
    ),
    "La selección": (
        {"Madrugamos para elegir lo mejor."},
        "Elegimos lo que merece llegar a ti.",
        "Frutas, verduras, tubérculos y granos para diferentes necesidades.",
    ),
    "Un solo pedido": (
        {"Todo lo que necesitas, en un solo pedido."},
        "Todo lo que necesitas, en un solo lugar.",
        "Una propuesta de abastecimiento para hogares y negocios.",
    ),
    "La entrega": (
        {"En tu puerta, fresco y a tiempo."},
        "Del campo a tu hogar o negocio.",
        "Productos organizados para acompañar tu día a día.",
    ),
}


def _esquema(esquema):
    esquema = copy.deepcopy(esquema or {})
    propiedades = esquema.setdefault("properties", {})
    propiedades.setdefault("intervalo", INTERVALO)
    capitulos = propiedades.get("capitulos")
    if isinstance(capitulos, dict):
        campos = capitulos.setdefault("items", {"tipo": "object"}).setdefault("properties", {})
        for clave, campo in CAMPOS_CAPITULO.items():
            campos.setdefault(clave, campo)
    return esquema


def _con_guion(composicion):
    salida = copy.deepcopy(composicion or [])
    tocado = False
    for bloque in salida:
        if bloque.get("tipo") != "historia-marca":
            continue
        for capitulo in (bloque.get("props") or {}).get("capitulos") or []:
            guion = GUION.get(capitulo.get("etiqueta"))
            if not guion:
                continue
            anteriores, titulo, texto = guion
            if capitulo.get("titulo") == titulo and capitulo.get("texto") == texto:
                continue
            if capitulo.get("titulo") in anteriores:
                capitulo["titulo"], capitulo["texto"] = titulo, texto
                tocado = True
    return salida if tocado else None


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    bloque = Bloque.objects.filter(codigo="historia-marca").first()
    if bloque is not None:
        bloque.esquema_props = _esquema(bloque.esquema_props)
        bloque.save(update_fields=["esquema_props"])

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = _con_guion(paginas.get("/"))
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
        nueva = _con_guion(publicada.composicion)
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
                nota="«Cómo trabajamos» con el guion de cuatro etapas: campo, selección, un solo pedido, entrega.",
                fecha_publicacion=timezone.now(),
            )

    for borrador in VersionPagina.objects.filter(pagina=pagina, estado="BORRADOR"):
        nueva = _con_guion(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])


def revertir(apps, schema_editor):
    # Como la 0055/0056: volver atrás el contenido es «Restaurar versión».
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0056_negocios_marco_y_chips")]

    operations = [migrations.RunPython(aplicar, revertir)]
