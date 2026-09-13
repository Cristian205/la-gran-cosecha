"""
Rediseño UX/UI de "/tienda": menos secciones independientes, un espacio de
merchandising editorial en vez de una segunda rejilla de productos.

# El problema que pidió resolver el encargo

"/tienda" apilaba nueve bloques de peso visual parecido (hero, anuncios,
categorías destacadas, más vendidos, navegación de categorías, barra de
búsqueda/orden, la rejilla, por-qué-elegirnos, públicos-objetivo) — la
sensación de "Hero -> sección -> cards -> sección -> cards" que el encargo
pide evitar. El síntoma más concreto: "productos-destacados" (`MasVendidos`)
pinta los más vendidos con la MISMA `ProductCard` que la rejilla de abajo, así
que un producto podía verse dos veces con idéntico tratamiento visual.

# La solución, siguiendo el mismo criterio que `0030`

Igual que `0030_home_anuncios_reemplaza_productos` ya hizo en el Home (ahí,
sustituir un `productos-destacados` por un `anuncios-carrusel`), esta
migración NO reescribe la composición desde cero: lee la versión PUBLICADA
actual de "/tienda" y

  1. quita los bloques que duplican peso visual con lo que ya hace
     `categorias-navegacion`/`grid-productos`, o que repiten contenido que
     el Home ya cuenta (`anuncios-carrusel`, `categorias-destacadas`,
     `productos-destacados`, `por-que-elegirnos`, `publicos-objetivo` — estos
     dos últimos SIGUEN en el Home, aquí solo se quitan de la tienda);
  2. inserta un `producto-destacado` (bloque nuevo, ver
     `frontend/tienda/src/componentes/ProductoDestacado.tsx`) justo después
     del hero: el mismo dato de "más vendidos" (primer puesto), pero con un
     dibujo editorial propio — grande, con su propio precio y su propio
     "agregar al pedido" — así que si el mismo producto vuelve a aparecer en
     la rejilla de abajo, se ve como catálogo, no como una repetición.

Se actualiza también la `Plantilla` "la-gran-cosecha" (el molde), con el
mismo criterio que ya usa `0028`/`0030`: para que una tienda nueva que la
adopte nazca con la composición mejorada, no con la que se está reemplazando.

# Por qué no se toca nada más

`categorias-navegacion`, `catalogo-toolbar` y `grid-productos` no se tocan:
son la lógica de catálogo real (búsqueda, filtro, orden, paginación) y el
encargo pide reorganizar la jerarquía visual, no rehacerla.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


BLOQUE_CATALOGO = {
    "codigo": "producto-destacado",
    "nombre": "Producto destacado",
    "categoria": "CONVERSION",
    "descripcion": "Un solo producto, tratado como publicidad: imagen grande, precio y compra directa.",
    "icono": "flame",
    "esquema_props": {
        "tipo": "object",
        "properties": {
            "kicker": texto("Antetítulo", "Favorito de nuestros clientes"),
            "texto": texto("Texto", "Uno de los productos con mayor demanda entre negocios como el tuyo."),
            "cta_texto": texto("Texto del botón", "Agregar al pedido"),
        },
    },
    "variantes": [],
    "requiere_datos": True,
    "unico_por_pagina": True,
    "a_sangre": False,
    "orden": 12,
}

PRODUCTO_DESTACADO_BLOQUE = {"tipo": "producto-destacado", "variante": "", "props": {}}

# Bloques que dejan de tener sitio en ESTA página. `por-que-elegirnos` y
# `publicos-objetivo` no se borran del catálogo ni de ninguna otra
# composición — el Home los sigue usando tal cual.
TIPOS_A_QUITAR = {
    "anuncios-carrusel",
    "categorias-destacadas",
    "productos-destacados",
    "por-que-elegirnos",
    "publicos-objetivo",
}


def _reorganizar(composicion):
    """Quita los bloques de `TIPOS_A_QUITAR` e inserta `producto-destacado`
    justo después del hero (o al principio, si no hubiera hero)."""
    if any(b.get("tipo") == "producto-destacado" for b in composicion):
        return composicion, False  # ya se aplicó antes; no duplicar en un re-run.

    nueva = [b for b in composicion if b.get("tipo") not in TIPOS_A_QUITAR]

    bloque_nuevo = {
        "id": "producto-destacado-0",
        "tipo": PRODUCTO_DESTACADO_BLOQUE["tipo"],
        "variante": PRODUCTO_DESTACADO_BLOQUE["variante"],
        "props": PRODUCTO_DESTACADO_BLOQUE["props"],
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }
    indice = 1 if nueva and nueva[0].get("tipo") == "catalogo-hero" else 0
    nueva.insert(indice, bloque_nuevo)
    return nueva, True


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    Bloque.objects.get_or_create(codigo=BLOQUE_CATALOGO["codigo"], defaults=BLOQUE_CATALOGO)

    # 1. El molde.
    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        tienda = paginas.get("/tienda")
        if tienda:
            nueva, cambiado = _reorganizar(tienda)
            if cambiado:
                paginas["/tienda"] = nueva
                plantilla.paginas = paginas
                plantilla.save(update_fields=["paginas"])

    # 2. El tenant real.
    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/tienda").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    nueva_composicion, cambiado = _reorganizar(list(publicada.composicion or []))
    if not cambiado:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])

    ultimo_numero = (
        pagina.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    )

    VersionPagina.objects.create(
        tenant=tenant,
        pagina=pagina,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva_composicion,
        nota=(
            "Rediseño UX: menos secciones independientes y un producto "
            "destacado editorial en vez de una segunda rejilla."
        ),
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    # Mismo criterio que 0028/0030: no se deshace contenido publicado en
    # automático. Volver atrás de verdad es "Restaurar versión" en el panel.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0043_bloque_texto_libre_y_nosotros_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
