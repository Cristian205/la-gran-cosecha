"""
Rediseño del pie: frase institucional junto al logo y la columna legal en dos
grupos (Legal y Ayuda).

Al esquema del bloque `pie` solo se le AGREGAN dos propiedades —`firma` y
`soporte_titulo`— sobre el esquema que haya, igual que en 0051: no se pisa
nada de lo que otra migración haya añadido.

En La Gran Cosecha además se ajusta el copy del pie publicado:
- `firma`: «Abastecimiento confiable para negocios.» bajo el nombre.
- La columna de contacto se titula «Contacto» y pierde el párrafo de
  introducción: el botón de WhatsApp ya dice qué hacer.
- La columna legal se titula «Legal»; su segundo grupo, «Ayuda».

Si hay un borrador del armazón, recibe los mismos cambios en vez de borrarse:
puede tener trabajo del negocio a medio hacer.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

NUEVAS = {
    "firma": {
        "tipo": "string",
        "titulo": "Frase institucional",
        "ayuda": "Frase corta y discreta bajo el nombre, junto al logo. Vacía no se dibuja.",
    },
    "soporte_titulo": {
        "tipo": "string",
        "titulo": "Columna legal: titulo del grupo de ayuda",
        "default": "Ayuda",
        "ayuda": "Envíos, devoluciones, retracto, medios de pago y PQRS.",
    },
}

PROPS_COSECHA = {
    "firma": "Abastecimiento confiable para negocios.",
    "ayuda_titulo": "Contacto",
    "ayuda_texto": "",
    "legal_titulo": "Legal",
    "soporte_titulo": "Ayuda",
}


def _con_props(composicion, props):
    """La composición con `props` mezcladas en el bloque `pie`, o None si no
    tiene pie."""
    cambiado = False
    nueva = []
    for bloque in composicion or []:
        if bloque.get("tipo") == "pie":
            bloque = {**bloque, "props": {**bloque.get("props", {}), **props}}
            cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.filter(codigo="pie"):
        esquema = dict(bloque.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        propiedades.update({k: v for k, v in NUEVAS.items() if k not in propiedades})
        esquema["properties"] = propiedades
        esquema.setdefault("tipo", "object")
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])

    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is None:
        return

    for borrador in layout.versiones.filter(estado="BORRADOR"):
        nueva = _con_props(borrador.composicion, PROPS_COSECHA)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])

    publicada = layout.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    nueva = _con_props(publicada.composicion, PROPS_COSECHA)
    if nueva is None:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo_numero = (
        layout.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    )
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=layout,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota="Pie: frase institucional, columna Contacto y grupos Legal / Ayuda.",
        fecha_publicacion=timezone.now(),
    )


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    for bloque in Bloque.objects.filter(codigo="pie"):
        esquema = dict(bloque.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        for clave in NUEVAS:
            propiedades.pop(clave, None)
        esquema["properties"] = propiedades
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])


class Migration(migrations.Migration):
    dependencies = [("storefront", "0051_pie_informacion_legal")]

    operations = [migrations.RunPython(aplicar, revertir)]
