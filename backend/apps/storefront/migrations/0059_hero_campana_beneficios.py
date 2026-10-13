"""
El banner principal (`hero-campana`) gana las piezas del rediseño, todas
opcionales y editables desde los paneles:

- `subtitulo_secundario`: una segunda línea, más tenue, bajo el subtítulo.
- `kicker_icono`: un icono antes del antetítulo (la ubicación).
- `cta_icono` / `cta2_icono`: un icono en cada botón.
- `beneficios`: la fila de tres (o los que sean) al pie del banner, en orden.
- `degradado = bosque`: verde bosque desde la izquierda que se desvanece hacia
  el centro (en móvil, desde arriba).

Sin estos datos el banner se ve exactamente igual que antes: ningún otro
negocio cambia.

Para La Gran Cosecha (y su plantilla) se cargan los textos del rediseño en el
Inicio. La foto NO se cambia aquí: es la que el negocio tiene subida y se
reemplaza desde el panel. Como en 0053, los borradores reciben el mismo cambio
y lo publicado se archiva con una versión nueva en el historial.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/"

ICONOS = ["", "ubicacion", "carrito", "canasta", "tienda", "camion", "hoja", "escudo", "reloj", "chispa", "telefono", "mensaje"]
ETIQUETAS_ICONOS = {
    "": "Sin icono",
    "ubicacion": "Ubicación",
    "carrito": "Carrito",
    "canasta": "Canasta",
    "tienda": "Tienda",
    "camion": "Camión",
    "hoja": "Hoja",
    "escudo": "Escudo",
    "reloj": "Reloj",
    "chispa": "Destello",
    "telefono": "Teléfono",
    "mensaje": "Mensaje",
}


def _icono(titulo, default=""):
    return {
        "tipo": "enum",
        "titulo": titulo,
        "opciones": ICONOS,
        "opciones_etiquetas": ETIQUETAS_ICONOS,
        "default": default,
    }


PROPS_NUEVAS = {
    "subtitulo_secundario": {
        "tipo": "string",
        "titulo": "Segunda línea del subtítulo",
        "ayuda": "Más tenue, debajo del subtítulo. Vacía: no se muestra.",
    },
    "kicker_icono": _icono("Icono del antetítulo"),
    "cta_icono": _icono("Icono del botón principal"),
    "cta2_icono": _icono("Icono del botón secundario"),
    "beneficios": {
        "tipo": "array",
        "titulo": "Beneficios (al pie del banner)",
        "ayuda": "Tres funcionan mejor. En el móvil se muestran en columnas pequeñas. Vacío: no se dibuja la fila.",
        "items": {
            "tipo": "object",
            "properties": {
                "texto": {"tipo": "string", "titulo": "Texto", "default": ""},
                "detalle": {"tipo": "string", "titulo": "Segunda línea (resaltada)", "default": ""},
                "icono": _icono("Icono", "hoja"),
            },
        },
    },
}

DEGRADADO_NUEVO = "bosque"

PROPS_COSECHA = {
    "kicker_icono": "ubicacion",
    "subtitulo_secundario": "Calidad, precio y entrega confiable.",
    "cta_icono": "carrito",
    "cta2_icono": "tienda",
    "degradado": DEGRADADO_NUEVO,
    "altura": "alta",
    "beneficios": [
        {"texto": "Productos", "detalle": "frescos del día", "icono": "hoja"},
        {"texto": "Pedidos para", "detalle": "hogares y negocios", "icono": "camion"},
        {"texto": "Calidad que", "detalle": "puedes confiar", "icono": "escudo"},
    ],
}


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------
def _catalogo(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    hero = Bloque.objects.filter(codigo="hero-campana").first()
    if hero is None:
        return
    esquema = dict(hero.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    for clave, campo in PROPS_NUEVAS.items():
        propiedades.setdefault(clave, campo)

    degradado = dict(propiedades.get("degradado") or {})
    opciones = list(degradado.get("opciones") or [])
    if degradado and DEGRADADO_NUEVO not in opciones:
        pos = opciones.index("ninguno") if "ninguno" in opciones else len(opciones)
        opciones.insert(pos, DEGRADADO_NUEVO)
        degradado["opciones"] = opciones
        degradado["opciones_etiquetas"] = {
            **(degradado.get("opciones_etiquetas") or {}),
            DEGRADADO_NUEVO: "Bosque: verde desde la izquierda",
        }
        propiedades["degradado"] = degradado

    esquema["properties"] = propiedades
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


def _catalogo_revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    hero = Bloque.objects.filter(codigo="hero-campana").first()
    if hero is None:
        return
    esquema = dict(hero.esquema_props or {})
    propiedades = {k: v for k, v in (esquema.get("properties") or {}).items() if k not in PROPS_NUEVAS}
    degradado = dict(propiedades.get("degradado") or {})
    if degradado:
        degradado["opciones"] = [o for o in degradado.get("opciones") or [] if o != DEGRADADO_NUEVO]
        degradado["opciones_etiquetas"] = {
            k: v for k, v in (degradado.get("opciones_etiquetas") or {}).items() if k != DEGRADADO_NUEVO
        }
        propiedades["degradado"] = degradado
    esquema["properties"] = propiedades
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


# --------------------------------------------------------------------------
# La Gran Cosecha
# --------------------------------------------------------------------------
def _con_rediseno(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "hero-campana" and not cambiado:
            props = dict(bloque.get("props") or {})
            if props.get("degradado") != DEGRADADO_NUEVO:
                bloque = {**bloque, "props": {**props, **PROPS_COSECHA}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _sin_rediseno(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "hero-campana":
            props = dict(bloque.get("props") or {})
            if props.get("degradado") == DEGRADADO_NUEVO:
                bloque = {**bloque, "props": {k: v for k, v in props.items() if k not in PROPS_COSECHA}}
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
    _transformar(apps, _con_rediseno, "Banner: degradado bosque, segunda línea, iconos y beneficios.")


def revertir(apps, schema_editor):
    _transformar(apps, _sin_rediseno, "Banner: vuelve el de antes.")
    _catalogo_revertir(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [("storefront", "0058_cabecera_comercio_y_navegacion_movil")]

    operations = [migrations.RunPython(aplicar, revertir)]
