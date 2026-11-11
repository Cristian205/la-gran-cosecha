"""
El banner principal (`hero-campana`) gana la opción `estilo_titulo`:

- `impacto`   (por defecto): el titular en mayúsculas gigantes de siempre.
- `editorial`: una frase en minúsculas, más sobria, con la línea resaltada en
  serif cursiva amarilla.

Ningún otro negocio cambia: sin la opción, el banner se ve igual que antes.

Para La Gran Cosecha (y su plantilla) el Inicio pasa al titular editorial con
el texto de la nueva pieza publicitaria. La foto NO se toca: es la que el
negocio tiene subida. Como en 0059, los borradores reciben el mismo cambio y lo
publicado se archiva con una versión nueva en el historial, así que se puede
volver atrás desde el panel.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
RUTA = "/"

ESTILO_TITULO = {
    "tipo": "enum",
    "titulo": "Estilo del titular",
    "opciones": ["impacto", "editorial"],
    "opciones_etiquetas": {
        "impacto": "Impacto: mayúsculas grandes",
        "editorial": "Editorial: frase y línea resaltada en cursiva",
    },
    "default": "impacto",
    "ayuda": "«Editorial» es más sobrio: minúsculas y la segunda línea en serif cursiva.",
}

# Lo que lleva el Inicio de La Gran Cosecha con la nueva pieza.
PROPS_NUEVAS = {
    "estilo_titulo": "editorial",
    "kicker": "La Gran Cosecha",
    "kicker_icono": "hoja",
    "titulo": "Frescura que alimenta tus días.",
    "titulo_resaltado": "Calidad que llega a tu puerta.",
    "subtitulo": "Frutas, verduras y productos seleccionados para tu hogar o negocio.",
    "subtitulo_secundario": "",
    "cta_texto": "Descubre nuestros productos",
    "cta_icono": "carrito",
    "cta2_visible": False,
    "beneficios": [],
}

# Lo que tenía (0045 + 0059), para poder revertir.
PROPS_ANTES = {
    "kicker": "La Gran Cosecha · Soacha, Cundinamarca",
    "kicker_icono": "ubicacion",
    "titulo": "Del campo",
    "titulo_resaltado": "a tu mesa.",
    "subtitulo": "Frescura que se nota.",
    "subtitulo_secundario": "Calidad, precio y entrega confiable.",
    "cta_texto": "Comprar ahora",
    "cta_icono": "carrito",
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
    if "estilo_titulo" in propiedades:
        return
    # Justo detrás de «Color del texto»: el orden del diccionario es el del formulario.
    salida = {}
    for clave, campo in propiedades.items():
        salida[clave] = campo
        if clave == "tono_texto":
            salida["estilo_titulo"] = ESTILO_TITULO
    salida.setdefault("estilo_titulo", ESTILO_TITULO)
    esquema["properties"] = salida
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


def _catalogo_revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    hero = Bloque.objects.filter(codigo="hero-campana").first()
    if hero is None:
        return
    esquema = dict(hero.esquema_props or {})
    esquema["properties"] = {
        k: v for k, v in (esquema.get("properties") or {}).items() if k != "estilo_titulo"
    }
    hero.esquema_props = esquema
    hero.save(update_fields=["esquema_props"])


# --------------------------------------------------------------------------
# La Gran Cosecha
# --------------------------------------------------------------------------
def _con_titulo_editorial(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "hero-campana" and not cambiado:
            props = dict(bloque.get("props") or {})
            if props.get("estilo_titulo") != "editorial":
                bloque = {**bloque, "props": {**props, **PROPS_NUEVAS}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _sin_titulo_editorial(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "hero-campana":
            props = dict(bloque.get("props") or {})
            if props.get("estilo_titulo") == "editorial":
                for clave in ("estilo_titulo", "cta2_visible"):
                    props.pop(clave, None)
                bloque = {**bloque, "props": {**props, **PROPS_ANTES}}
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
    _transformar(apps, _con_titulo_editorial, "Banner: titular editorial y nuevo texto.")


def revertir(apps, schema_editor):
    _transformar(apps, _sin_titulo_editorial, "Banner: vuelve el titular de antes.")
    _catalogo_revertir(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [("storefront", "0071_proceso_primera_escena_clara")]

    operations = [migrations.RunPython(aplicar, revertir)]
