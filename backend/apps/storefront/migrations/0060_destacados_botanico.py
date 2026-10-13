"""
Los más vendidos (`producto-spotlight`) ganan la variante «botánico».

Fondo blanco, ramas de trazo fino en las esquinas, curvas doradas,
flechas a los lados y pestañas tipo tarjeta. Es una VARIANTE y no un cambio
del aspecto base: los negocios que ya usan el bloque no cambian.

Propiedades nuevas, editables desde los paneles:

- `texto_resaltado`: el final del texto en serif cursiva («como el tuyo.»).
- `decoracion`: mostrar u ocultar las ramas y las curvas.
- `mostrar_puesto`: la etiqueta «N.º X» sobre la foto. Aun encendida, solo
  aparece cuando el puesto es real (sale del ranking de ventas).
- `mostrar_marco` / `marco`: el marco de hojas y cinta dorada alrededor del
  bloque, y una imagen propia para reemplazarlo.

Y tres colores que el bloque admite como estilo propio, sin valor por
defecto (sin tocarlos, los de la marca): fondo, acento y dorado.

Los productos, fotos, nombres y precios siguen saliendo del catálogo y del
ranking real; aquí no se escribe ninguno. Para La Gran Cosecha (y su
plantilla) se activa la variante y se separa el final del texto para
resaltarlo. Como en 0053, lo publicado se archiva con una versión nueva.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/"
BLOQUE = "producto-spotlight"
VARIANTE = {"codigo": "botanico", "nombre": "Botánico: fondo blanco, hojas y dorado"}

PROPS_NUEVAS = {
    "texto_resaltado": {
        "tipo": "string",
        "titulo": "Final del texto resaltado",
        "ayuda": "Va después del texto, en serif cursiva y color de acento. Ej.: «como el tuyo.»",
    },
    "decoracion": {
        "tipo": "boolean",
        "titulo": "Mostrar hojas y curvas decorativas",
        "ayuda": "Solo en la variante «Botánico». En el móvil se reducen solas.",
        "default": True,
    },
    "mostrar_puesto": {
        "tipo": "boolean",
        "titulo": "Mostrar la etiqueta «N.º» sobre la foto",
        "ayuda": "Solo aparece cuando el puesto es real, es decir, sale del ranking de ventas.",
        "default": True,
    },
    "mostrar_marco": {
        "tipo": "boolean",
        "titulo": "Mostrar el marco de hojas",
        "ayuda": "Solo en la variante «Botánico» y en pantallas anchas: en el móvil quedan las hojas pequeñas.",
        "default": True,
    },
    "marco": {
        "tipo": "string",
        "titulo": "Imagen del marco (opcional)",
        "ayuda": "PNG o WebP apaisado con fondo transparente. Vacía: el marco de hojas y cinta dorada de la variante.",
        "formato": "imagen",
    },
}

TOKENS = [
    {
        "codigo": "destacados-fondo",
        "nombre": "Fondo de los más vendidos",
        "variable_css": "--ps-fondo",
        "valor_por_defecto": "",
        "descripcion": "Variante «Botánico». Vacío: blanco.",
        "grupo": "SUPERFICIE",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 200,
    },
    {
        "codigo": "destacados-acento",
        "nombre": "Acento de los más vendidos",
        "variable_css": "--ps-acento",
        "valor_por_defecto": "",
        "descripcion": "Botón principal, antetítulo, etiqueta «N.º» y pestaña activa. Vacío: el acento de la marca.",
        "grupo": "SUPERFICIE",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 210,
    },
    {
        "codigo": "destacados-dorado",
        "nombre": "Color de los adornos",
        "variable_css": "--ps-dorado",
        "valor_por_defecto": "",
        "descripcion": "Las líneas de las hojas y las curvas. Vacío: un dorado apagado.",
        "grupo": "SUPERFICIE",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 220,
    },
]

TEXTO_ANTES = "Uno de los productos que más piden negocios como el tuyo."
PROPS_COSECHA = {
    "texto": "Uno de los productos que más piden negocios",
    "texto_resaltado": "como el tuyo.",
    "decoracion": True,
    "mostrar_puesto": True,
    "mostrar_marco": True,
}


def _catalogo(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    TokenTema = apps.get_model("storefront", "TokenTema")
    for datos in TOKENS:
        TokenTema.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    bloque = Bloque.objects.filter(codigo=BLOQUE).first()
    if bloque is None:
        return
    esquema = dict(bloque.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    for clave, campo in PROPS_NUEVAS.items():
        propiedades.setdefault(clave, campo)
    esquema["properties"] = propiedades
    bloque.esquema_props = esquema

    variantes = list(bloque.variantes or [])
    if not any(isinstance(v, dict) and v.get("codigo") == VARIANTE["codigo"] for v in variantes):
        variantes.append(dict(VARIANTE))
    bloque.variantes = variantes

    admitidos = list(bloque.tokens_admitidos or [])
    for datos in TOKENS:
        if datos["codigo"] not in admitidos:
            admitidos.append(datos["codigo"])
    bloque.tokens_admitidos = admitidos
    bloque.save(update_fields=["esquema_props", "variantes", "tokens_admitidos"])


def _catalogo_revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    TokenTema = apps.get_model("storefront", "TokenTema")
    codigos = [t["codigo"] for t in TOKENS]
    bloque = Bloque.objects.filter(codigo=BLOQUE).first()
    if bloque is not None:
        esquema = dict(bloque.esquema_props or {})
        esquema["properties"] = {
            k: v for k, v in (esquema.get("properties") or {}).items() if k not in PROPS_NUEVAS
        }
        bloque.esquema_props = esquema
        bloque.variantes = [
            v for v in (bloque.variantes or []) if not (isinstance(v, dict) and v.get("codigo") == VARIANTE["codigo"])
        ]
        bloque.tokens_admitidos = [c for c in (bloque.tokens_admitidos or []) if c not in codigos]
        bloque.save(update_fields=["esquema_props", "variantes", "tokens_admitidos"])
    TokenTema.objects.filter(codigo__in=codigos).delete()


def _a_botanico(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == BLOQUE and bloque.get("variante") != VARIANTE["codigo"]:
            props = dict(bloque.get("props") or {})
            extra = dict(PROPS_COSECHA)
            # Solo se parte el texto si sigue siendo el de siempre: si el
            # negocio ya lo cambió, se respeta el suyo.
            if (props.get("texto") or TEXTO_ANTES) != TEXTO_ANTES:
                extra.pop("texto")
                extra.pop("texto_resaltado")
            bloque = {**bloque, "variante": VARIANTE["codigo"], "props": {**props, **extra}}
            cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _de_botanico(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == BLOQUE and bloque.get("variante") == VARIANTE["codigo"]:
            props = {k: v for k, v in (bloque.get("props") or {}).items() if k not in PROPS_NUEVAS}
            if props.get("texto") == PROPS_COSECHA["texto"]:
                props["texto"] = TEXTO_ANTES
            bloque = {**bloque, "variante": "", "props": props}
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
    _catalogo(apps, schema_editor)
    _transformar(apps, _a_botanico, "Más vendidos: variante «Botánico».")


def revertir(apps, schema_editor):
    _transformar(apps, _de_botanico, "Más vendidos: vuelve el aspecto de siempre.")
    _catalogo_revertir(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [("storefront", "0059_hero_campana_beneficios")]

    operations = [migrations.RunPython(aplicar, revertir)]
