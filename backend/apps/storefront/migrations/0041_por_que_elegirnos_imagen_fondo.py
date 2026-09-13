"""
`imagen_fondo` en "Por qué elegirnos": una foto propia para la variante
Mármol, en vez del degradado de respaldo.

Se activa de una vez en el Home de La Gran Cosecha con la foto que el
negocio ya generó (`/img/fondo-marmol-lgc.jpg`, servida por la propia
tienda). Sin esta propiedad la variante sigue viéndose con el degradado —
ver `.pqe-marmol` en `global.css` — así que ninguna otra tienda que ya use
Mármol nota el cambio.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
IMAGEN_FONDO = "/img/fondo-marmol-lgc.jpg"


def texto(titulo, defecto="", ayuda=""):
    campo = {"tipo": "string", "titulo": titulo}
    if defecto:
        campo["default"] = defecto
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def numero(titulo, defecto=None, minimo=1, maximo=None, ayuda=""):
    campo = {"tipo": "number", "titulo": titulo, "minimo": minimo}
    if defecto is not None:
        campo["default"] = defecto
    if maximo is not None:
        campo["maximo"] = maximo
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


ESQUEMA_PROPS_ANTES = objeto(
    kicker=texto("Antetitulo", "Confianza"),
    titulo=texto("Titulo", "Por que comprar con nosotros?"),
    subtitulo=texto("Texto a la derecha"),
    limite=numero("Cuantos beneficios", minimo=1, maximo=12),
)

ESQUEMA_PROPS_AHORA = objeto(
    kicker=texto("Antetitulo", "Confianza"),
    titulo=texto("Titulo", "Por que comprar con nosotros?"),
    subtitulo=texto("Texto a la derecha"),
    limite=numero("Cuantos beneficios", minimo=1, maximo=12),
    imagen_fondo=texto(
        "Imagen de fondo (solo Mármol)",
        ayuda="Reemplaza el mármol de respaldo por una foto propia. Sin ella, se ve el degradado neutro.",
    ),
)


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="por-que-elegirnos").update(esquema_props=ESQUEMA_PROPS_AHORA)

    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    cambiado = False
    nueva = []
    for bloque in publicada.composicion:
        if bloque.get("tipo") == "por-que-elegirnos":
            props = {**bloque.get("props", {}), "imagen_fondo": IMAGEN_FONDO}
            bloque = {**bloque, "props": props}
            cambiado = True
        nueva.append(bloque)

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
        composicion=nueva,
        nota="Por qué elegirnos: foto de mármol propia.",
        fecha_publicacion=timezone.now(),
    )
    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="por-que-elegirnos").update(esquema_props=ESQUEMA_PROPS_ANTES)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0040_por_que_elegirnos_marmol")]

    operations = [migrations.RunPython(aplicar, revertir)]
