"""
El hero de Nosotros (`nosotros-hero`) gana dos opciones:

- `estilo`: `clasico` (el de siempre) o `publicitario`, una pieza de anuncio
  con la columna de texto a la izquierda sobre un degradado verde, y en móvil
  el texto arriba y la foto abajo.
- `atributos`: tres (o los que sean) puntos de confianza con icono verde,
  entre la descripción y los botones. Solo se dibujan en el estilo publicitario.

Sin las opciones el hero se ve exactamente igual que antes: ningún otro negocio
cambia.

Para La Gran Cosecha (y su plantilla) /nosotros pasa al estilo publicitario con
sus tres atributos. La foto NO se toca: se sube desde el panel. Como en 0072,
los borradores reciben el mismo cambio y lo publicado se archiva con una
versión nueva en el historial, así que se puede volver atrás desde el panel.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/nosotros"
BLOQUE = "nosotros-hero"

ICONOS = ["calidad", "entrega", "crecimiento", "hoja", "escudo", "reloj", "canasta", "estrella"]
ETIQUETAS_ICONOS = {
    "calidad": "Calidad (sello)",
    "entrega": "Entrega (camión)",
    "crecimiento": "Crecimiento",
    "hoja": "Hoja",
    "escudo": "Escudo",
    "reloj": "Reloj",
    "canasta": "Canasta",
    "estrella": "Estrella",
}

ESQUEMA_NUEVO = {
    "estilo": {
        "tipo": "enum",
        "titulo": "Estilo del hero",
        "opciones": ["clasico", "publicitario"],
        "opciones_etiquetas": {
            "clasico": "Clásico: titular abajo y recorrido",
            "publicitario": "Publicitario: texto a la izquierda y atributos",
        },
        "default": "clasico",
        "ayuda": "«Publicitario» pensado para una foto con personas. No dibuja el recorrido.",
    },
    "atributos": {
        "tipo": "array",
        "titulo": "Atributos de confianza (estilo publicitario)",
        "ayuda": "Tres funcionan mejor. En el móvil van en tres columnas pequeñas.",
        "items": {
            "tipo": "object",
            "properties": {
                "texto": {"tipo": "string", "titulo": "Texto", "default": ""},
                "icono": {
                    "tipo": "enum",
                    "titulo": "Icono",
                    "opciones": ICONOS,
                    "opciones_etiquetas": ETIQUETAS_ICONOS,
                    "default": "calidad",
                },
            },
        },
    },
}

PROPS_NUEVAS = {
    "estilo": "publicitario",
    "atributos": [
        {"texto": "Productos de calidad", "icono": "calidad"},
        {"texto": "Entrega confiable", "icono": "entrega"},
        {"texto": "Aliado de tu crecimiento", "icono": "crecimiento"},
    ],
}


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------
def _catalogo(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    hero = Bloque.objects.filter(codigo=BLOQUE).first()
    if hero is None:
        return
    esquema = dict(hero.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    for clave, campo in ESQUEMA_NUEVO.items():
        propiedades.setdefault(clave, campo)
    esquema["properties"] = propiedades
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


def _catalogo_revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    hero = Bloque.objects.filter(codigo=BLOQUE).first()
    if hero is None:
        return
    esquema = dict(hero.esquema_props or {})
    esquema["properties"] = {
        k: v for k, v in (esquema.get("properties") or {}).items() if k not in ESQUEMA_NUEVO
    }
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


# --------------------------------------------------------------------------
# La Gran Cosecha
# --------------------------------------------------------------------------
def _con_estilo(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == BLOQUE and not cambiado:
            props = dict(bloque.get("props") or {})
            if props.get("estilo") != "publicitario":
                bloque = {**bloque, "props": {**props, **PROPS_NUEVAS}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _sin_estilo(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == BLOQUE:
            props = dict(bloque.get("props") or {})
            if props.get("estilo") == "publicitario":
                bloque = {**bloque, "props": {k: v for k, v in props.items() if k not in PROPS_NUEVAS}}
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
    _transformar(apps, _con_estilo, "Hero de Nosotros: estilo publicitario y atributos.")


def revertir(apps, schema_editor):
    _transformar(apps, _sin_estilo, "Hero de Nosotros: vuelve el estilo clásico.")
    _catalogo_revertir(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [("storefront", "0072_hero_titulo_editorial")]

    operations = [migrations.RunPython(aplicar, revertir)]
