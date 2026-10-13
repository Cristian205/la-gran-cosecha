"""
Lleva a la base lo que 0058 y 0060 terminaron siendo.

Esas dos migraciones se aplicaron con su primera versión y después cambiaron
en el código; Django no vuelve a correr una migración ya aplicada, así que en
las bases donde se aplicaron temprano quedó lo de antes. Esta deja el estado
acordado, y en una base que las aplicó ya en su versión final no cambia nada
(cada paso comprueba antes de escribir).

La Gran Cosecha (y su plantilla):
- Barra inferior del móvil: Inicio, Tienda, Nosotros y Contacto. Buscar y
  «Mi pedido» vuelven a la barra de arriba (allí salen solos cuando no están
  abajo).
- Sin «Mi cuenta» y sin el botón aparte de Tienda (ya es un enlace del menú).

Catálogo de bloques:
- `cabecera`: el botón de compra recupera su título de siempre y la variante
  «Comercio» su nombre final.
- `producto-spotlight`: los campos del marco (`mostrar_marco`, `marco`) y el
  nombre final de la variante («fondo blanco»).
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

NAV_MOVIL = [
    {"tipo": "inicio", "texto": "", "icono": "", "href": ""},
    {"tipo": "tienda", "texto": "", "icono": "", "href": ""},
    {"tipo": "enlace", "texto": "Nosotros", "icono": "nosotros", "href": "/nosotros"},
    {"tipo": "enlace", "texto": "Contacto", "icono": "contacto", "href": "/contacto"},
]
PROPS_CABECERA = {"nav_movil": NAV_MOVIL, "boton_texto": "", "cuenta_modo": "oculta"}

TITULOS_CABECERA = {
    "boton_texto": {
        "titulo": "Botón de compra (solo escritorio)",
        "ayuda": "Un botón «Comprar» junto al carrito. No se muestra si el menú ya tiene un enlace al mismo destino. Vacío: no se muestra.",
    },
    "boton_href": {"titulo": "Enlace del botón de compra"},
}
NOMBRE_COMERCIO = "Comercio: franja de avisos y buscador protagonista"

PROPS_MARCO = {
    "mostrar_marco": {
        "tipo": "boolean",
        "titulo": "Mostrar el marco de hojas",
        "ayuda": "Solo en la variante «Botánico». En el móvil se dibuja con las esquinas a escala.",
        "default": True,
    },
    "marco": {
        "tipo": "string",
        "titulo": "Imagen del marco (opcional)",
        "ayuda": "PNG o WebP apaisado con fondo transparente. Vacía: el marco de hojas y cinta dorada de la variante.",
        "formato": "imagen",
    },
}
NOMBRE_BOTANICO = "Botánico: fondo blanco, hojas y dorado"


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------
def _renombrar_variante(bloque, codigo, nombre):
    variantes = []
    cambiado = False
    for v in bloque.variantes or []:
        if isinstance(v, dict) and v.get("codigo") == codigo and v.get("nombre") != nombre:
            v = {**v, "nombre": nombre}
            cambiado = True
        variantes.append(v)
    bloque.variantes = variantes
    return cambiado


def _catalogo(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    TokenTema = apps.get_model("storefront", "TokenTema")

    cabecera = Bloque.objects.filter(codigo="cabecera").first()
    if cabecera is not None:
        esquema = dict(cabecera.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        for clave, cambios in TITULOS_CABECERA.items():
            if clave in propiedades:
                propiedades[clave] = {**propiedades[clave], **cambios}
        esquema["properties"] = propiedades
        cabecera.esquema_props = esquema
        _renombrar_variante(cabecera, "comercio", NOMBRE_COMERCIO)
        cabecera.save(update_fields=["esquema_props", "variantes"])

    destacados = Bloque.objects.filter(codigo="producto-spotlight").first()
    if destacados is not None:
        esquema = dict(destacados.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        for clave, campo in PROPS_MARCO.items():
            propiedades.setdefault(clave, campo)
        esquema["properties"] = propiedades
        destacados.esquema_props = esquema
        _renombrar_variante(destacados, "botanico", NOMBRE_BOTANICO)
        destacados.save(update_fields=["esquema_props", "variantes"])

    TokenTema.objects.filter(codigo="destacados-fondo").update(descripcion="Variante «Botánico». Vacío: blanco.")


# --------------------------------------------------------------------------
# La Gran Cosecha
# --------------------------------------------------------------------------
def _cabecera_final(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera" and bloque.get("variante") == "comercio":
            props = dict(bloque.get("props") or {})
            if any(props.get(k) != v for k, v in PROPS_CABECERA.items()):
                bloque = {**bloque, "props": {**props, **PROPS_CABECERA}}
                cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _transformar(apps, ruta, transformar, nota):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Tenant = apps.get_model("tenancy", "Tenant")

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = transformar(paginas.get(ruta))
        if nueva is not None:
            paginas[ruta] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    pagina = Pagina.objects.filter(tenant=tenant, ruta=ruta).first()
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
    _transformar(
        apps,
        "/_layout",
        _cabecera_final,
        "Móvil: Buscar y Mi pedido arriba; abajo Inicio, Tienda, Nosotros y Contacto. Sin Mi cuenta.",
    )


class Migration(migrations.Migration):
    dependencies = [("storefront", "0060_destacados_botanico")]

    # Sin vuelta atrás propia: revertir 0058/0060 ya deshace la cabecera y
    # los campos; esto solo los alinea con su versión final.
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
