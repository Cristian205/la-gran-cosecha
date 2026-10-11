"""
La campaña para negocios de La Gran Cosecha pasa a ser un collage publicitario.

# Qué cambia

`campana-negocios` gana tres propiedades:

    collage        lista de fotos (escritorio + móvil + texto alternativo).
                   Con dos o más, el bloque se compone como collage: mensaje
                   a la izquierda y fotos de clientes a la derecha.
    beneficios     hasta cuatro ventajas con icono, en una franja bajo el botón.
    mostrar_logo   el logo del negocio (el de su configuración) sobre el titular.

Sin `collage` el bloque se ve exactamente como antes, así que ninguna otra
tienda cambia.

En La Gran Cosecha, la sección «Tu negocio también necesita frescura» pasa a
decir que la marca abastece hogares Y negocios: «Todo lo fresco que necesitas.
Directo a tu mesa o negocio.», con el botón al catálogo y cinco fotos —hogar,
cocina profesional, hotel, frutería y reparto— en `/img/home/clientes/`
(Unsplash, licencia libre; ver el CREDITOS.md de esa carpeta).

# Cómo se aplica

Solo se toca ESE bloque, no la página:

* la versión publicada se copia a una nueva versión publicada con el bloque
  actualizado, y la anterior queda ARCHIVADA («Restaurar versión» en el panel
  la devuelve);
* si hay un borrador, se actualiza el mismo bloque dentro de él, sin perder el
  resto de lo que se esté editando;
* la plantilla de La Gran Cosecha recibe el mismo cambio para tiendas nuevas.
"""
import copy

from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"
CARPETA = "/img/home/clientes"

ICONOS = [
    ("hoja", "Hoja"),
    ("escudo", "Escudo"),
    ("carrito", "Carrito"),
    ("camion", "Camión"),
    ("personas", "Personas"),
    ("reloj", "Reloj"),
]

PROPIEDADES_NUEVAS = {
    "mostrar_logo": {
        "tipo": "boolean",
        "titulo": "Mostrar el logo del negocio",
        "default": False,
        "ayuda": "Usa el logo de tu configuración, encima del titular.",
    },
    "collage": {
        "tipo": "array",
        "titulo": "Collage de fotos",
        "ayuda": "Con dos o más fotos la sección se muestra como collage (hasta cinco; en móvil se ven cuatro).",
        "items": {
            "tipo": "object",
            "properties": {
                "imagen": {"tipo": "string", "titulo": "Foto", "formato": "imagen"},
                "imagen_movil": {"tipo": "string", "titulo": "Foto para móvil (opcional)", "formato": "imagen"},
                "alt": {"tipo": "string", "titulo": "Texto alternativo"},
            },
        },
    },
    "beneficios": {
        "tipo": "array",
        "titulo": "Beneficios",
        "ayuda": "Hasta cuatro, en una franja bajo el botón.",
        "items": {
            "tipo": "object",
            "properties": {
                "icono": {
                    "tipo": "enum",
                    "titulo": "Icono",
                    "opciones": [c for c, _ in ICONOS],
                    "opciones_etiquetas": dict(ICONOS),
                    "default": "hoja",
                },
                "texto": {"tipo": "string", "titulo": "Texto"},
            },
        },
    },
}


def _foto(nombre, alt):
    return {"imagen": f"{CARPETA}/{nombre}.webp", "imagen_movil": f"{CARPETA}/{nombre}-sm.webp", "alt": alt}


CONTENIDO = {
    "kicker": "",
    "titulo": "Todo lo fresco que necesitas.",
    "titulo_resaltado": "Directo a tu mesa o negocio.",
    "texto": "Frutas, verduras, tubérculos y granos para tu hogar, restaurantes, hoteles, cafeterías y comercios.",
    "mostrar_logo": True,
    "cta_texto": "Comprar productos",
    "cta_href": "/tienda",
    "cta2_texto": "Abastecer mi negocio",
    "cta2_href": "/contacto",
    "segmentos": [],
    "imagen": "",
    "imagen_alt": "",
    "collage": [
        _foto("hogar", "Mujer eligiendo una piña en la sección de frutas y verduras"),
        _foto("chef", "Chef con delantal cortando zanahorias frescas en una cocina profesional"),
        _foto("hotel", "Personal de servicio llevando dos bandejas de fruta fresca cortada"),
        _foto("fruteria", "Comerciante sonriente en su frutería, entre cajas de frutas y verduras"),
        _foto("entrega", "Trabajadores descargando cajas de verduras de un camión de reparto"),
    ],
    "beneficios": [
        {"icono": "hoja", "texto": "Productos frescos"},
        {"icono": "escudo", "texto": "Calidad garantizada"},
        {"icono": "camion", "texto": "Pedidos fáciles"},
        {"icono": "personas", "texto": "Para hogares y negocios"},
    ],
}


def _con_collage(composicion):
    """La composición con el bloque de negocios actualizado; None si no hay nada que hacer."""
    salida = copy.deepcopy(composicion or [])
    tocado = False
    for bloque in salida:
        if bloque.get("tipo") != "campana-negocios":
            continue
        props = bloque.setdefault("props", {})
        if props.get("collage"):
            continue  # ya aplicada, o alguien ya puso su propio collage
        props.update(copy.deepcopy(CONTENIDO))
        tocado = True
    return salida if tocado else None


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    bloque = Bloque.objects.filter(codigo="campana-negocios").first()
    if bloque is not None:
        esquema = copy.deepcopy(bloque.esquema_props or {})
        propiedades = esquema.setdefault("properties", {})
        for clave, campo in PROPIEDADES_NUEVAS.items():
            propiedades.setdefault(clave, campo)
        bloque.esquema_props = esquema
        bloque.save(update_fields=["esquema_props"])

    plantilla = Plantilla.objects.filter(slug=PLANTILLA_SLUG).first()
    if plantilla is not None:
        paginas = dict(plantilla.paginas or {})
        nueva = _con_collage(paginas.get("/"))
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
        nueva = _con_collage(publicada.composicion)
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
                nota="Campaña para negocios como collage: hogares, cocinas, hoteles, fruterías y reparto.",
                fecha_publicacion=timezone.now(),
            )

    for borrador in VersionPagina.objects.filter(pagina=pagina, estado="BORRADOR"):
        nueva = _con_collage(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])


def revertir(apps, schema_editor):
    # Como 0045–0048: volver atrás el contenido es «Restaurar versión» en el
    # panel. El esquema conserva las claves: quitarlas no rompería nada, pero
    # dejaría sin formulario un collage ya puesto.
    pass


class Migration(migrations.Migration):

    dependencies = [("storefront", "0054_banner_por_dispositivo")]

    operations = [migrations.RunPython(aplicar, revertir)]
