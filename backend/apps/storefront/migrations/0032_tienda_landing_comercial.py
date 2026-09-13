"""
La tienda pasa de "catálogo digital" a "plataforma de abastecimiento B2B".

Sigue el mismo patrón quirúrgico que `0030_home_anuncios_reemplaza_productos`:
lee la versión PUBLICADA actual de "/tienda", modifica en el sitio los
bloques que ya existen (el hero gana copy e imagen, la rejilla gana
encabezado y un ancla) e INSERTA los bloques nuevos donde corresponde, sin
tocar nada que el negocio haya ajustado desde el panel entretanto. Nada se
reescribe desde cero.

# El orden nuevo

    catalogo-hero          — mismo bloque, copy nuevo, con la MISMA foto de
                              cajón de frutas que el propio negocio ya subió
                              para el Hero del Home (no se inventa una nueva).
    anuncios-carrusel      — el carrusel publicitario que ya existe desde el
                              rediseño del Home (`content.Anuncio`); comparte
                              el mismo fondo de campañas en las dos páginas,
                              a propósito: es un carrusel de campañas VIGENTES
                              del negocio, no contenido exclusivo de una
                              sección.
    categorias-destacadas  — "Compra por categoría", tarjetas compactas.
    productos-destacados   — "Los más pedidos", con las cintas comerciales
                              ("Más pedido"/"Favorito"/"Alta rotación") que ya
                              trae `MasVendidos` desde el rediseño del Home.
    categorias-navegacion  — SIN CAMBIOS: el filtro en vivo por categoría.
    catalogo-toolbar       — SIN CAMBIOS: buscador + orden + contador.
    grid-productos         — SIN CAMBIOS de lógica; gana encabezado
                              ("Todos los productos") y un ancla ("catalogo")
                              para que el CTA del hero, que ya apuntaba a
                              "#catalogo", tenga per fin adónde bajar.
    por-que-elegirnos      — "¿Por qué comprar con La Gran Cosecha?"
    publicos-objetivo      — "Todo lo que tu negocio necesita."

No se inventan productos, categorías, precios ni presentaciones: los bloques
nuevos son de contenido propio (beneficios, públicos) o leen datos reales ya
existentes (categorías y productos del catálogo).

Solo toca a la `Pagina` "/tienda" del tenant "la-gran-cosecha". Igual que
`0030`, no se revierte automáticamente el contenido — "Restaurar versión" en
el panel es el camino real de vuelta atrás.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

IMAGEN_HERO = (
    "https://pub-d9ed2b3f0c8c4677a9b68b7dcf17e565.r2.dev/media/tenants/"
    "f7ab4600-83cb-42ab-b17a-d694532d8b71/biblioteca/2026/09/"
    "13e75ef7fd3a49e2b6229892_K7TEKqP.png"
)

PUBLICOS_NEGOCIO = {
    "titulo": "Todo lo que tu negocio necesita.",
    "publicos": [
        {
            "titulo": "Restaurantes",
            "texto": "Abastece tu cocina con productos frescos sin salir de tu negocio.",
            "icono": "restaurante",
        },
        {
            "titulo": "Tiendas",
            "texto": "Encuentra frutas y productos de calidad para tu negocio todos los días.",
            "icono": "canasta",
        },
        {
            "titulo": "Fruver",
            "texto": "Reabastece tu surtido con precio del día y entrega puntual.",
            "icono": "edificio",
        },
        {
            "titulo": "Hoteles",
            "texto": "Volumen y variedad para una operación que no puede detenerse.",
            "icono": "edificio",
        },
        {
            "titulo": "Negocios de alimentos",
            "texto": "Soluciones de abastecimiento confiables para tu operación diaria.",
            "icono": "cafeteria",
        },
    ],
}


def normalizar(bruto, indice):
    return {
        "id": bruto.get("id") or f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": bruto.get("visible") or {"movil": True, "tablet": True, "escritorio": True},
    }


def transformar(composicion):
    nueva = []
    for bloque in composicion:
        if bloque.get("tipo") == "catalogo-hero":
            bloque = {
                **bloque,
                "props": {
                    **bloque.get("props", {}),
                    "kicker": "Abastecimiento para negocios",
                    "titulo": "Frescura que mueve",
                    "titulo_resaltado": "tu negocio.",
                    "texto": (
                        "Frutas, verduras, tubérculos, granos y más para "
                        "abastecer tu negocio."
                    ),
                    "imagen": IMAGEN_HERO,
                    "cta_texto": "Explorar productos",
                    "cta_href": "#catalogo",
                },
            }
            nueva.append(bloque)
            nueva.append(
                normalizar({"tipo": "anuncios-carrusel", "props": {"autoplay": True, "segundos": 7}}, len(nueva))
            )
            nueva.append(
                normalizar(
                    {
                        "tipo": "categorias-destacadas",
                        "variante": "tarjetas",
                        "props": {
                            "kicker": "Catálogo",
                            "titulo": "Compra por categoría",
                            "subtitulo": "",
                        },
                    },
                    len(nueva),
                )
            )
            nueva.append(
                normalizar(
                    {
                        "tipo": "productos-destacados",
                        "variante": "rejilla",
                        "props": {
                            "kicker": "Los preferidos",
                            "titulo": "Los más pedidos",
                            "subtitulo": "Productos que otros negocios ya están comprando.",
                            "limite": 5,
                        },
                    },
                    len(nueva),
                )
            )
        elif bloque.get("tipo") == "grid-productos":
            nueva.append(
                {
                    **bloque,
                    "props": {
                        **bloque.get("props", {}),
                        "kicker": "Catálogo completo",
                        "titulo": "Todos los productos",
                        "subtitulo": "Encuentra todo lo que necesitas para abastecer tu negocio.",
                        "id": "catalogo",
                    },
                }
            )
        else:
            nueva.append(bloque)

    nueva.append(normalizar({"tipo": "por-que-elegirnos", "props": {}}, len(nueva)))
    nueva.append(normalizar({"tipo": "publicos-objetivo", "variante": "tarjetas", "props": PUBLICOS_NEGOCIO}, len(nueva)))
    return nueva


def aplicar(apps, schema_editor):
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/tienda").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    nueva_composicion = transformar(publicada.composicion)

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
        nota="Landing comercial B2B: hero, anuncios, categorías, más pedidos, beneficios, para negocios.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    # Mismo criterio que 0030: no se deshace contenido publicado en
    # automático. "Restaurar versión" en el panel es el camino real.
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0031_categorias_navegacion_requiere_datos")]

    operations = [migrations.RunPython(aplicar, revertir)]
