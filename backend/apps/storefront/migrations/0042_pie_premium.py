"""
Rediseño del pie: separa el CTA en su propia tarjeta, añade el reclamo de
marca, la línea de reparto y los enlaces legales de la barra inferior.

Solo agrega propiedades (`tagline`, `entrega_texto`, `privacidad_href`,
`privacidad_texto`, `terminos_href`, `terminos_texto`) al esquema del bloque
`pie` — nada de lo que ya había cambia de nombre ni de forma, así que
cualquier tienda que ya lo tenga configurado sigue viéndose igual hasta que
alguien llene los campos nuevos.

Además activa el copy nuevo en el Home de La Gran Cosecha: el reclamo bajo el
logo, el texto de reparto y el nuevo texto del CTA. Los enlaces legales se
dejan SIN `href` a propósito — el negocio todavía no tiene esas páginas
escritas, y un enlace a una página que no existe es peor que no tenerlo.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

TAGLINE = "Abastecemos negocios que no pueden parar."
LEMA = "Frutas, verduras, tubérculos y productos seleccionados para tu operación diaria."
ENTREGA_TEXTO = "Entregas para negocios"
CTA_TEXTO = "Productos frescos para mantener tu operación en marcha."

# La columna "La empresa" no repite "Productos" — esa ya es su propia
# columna ahora. El resto de destinos se deja tal cual: no se inventan
# anclas que la página de Nosotros no tiene.
ENLACES_EMPRESA = [
    {"href": "/nosotros", "texto": "Cómo funciona", "exacto": False},
    {"href": "/nosotros", "texto": "Para negocios", "exacto": False},
    {"href": "/nosotros", "texto": "Nosotros", "exacto": False},
    {"href": "/contacto", "texto": "Contacto", "exacto": False},
]


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


def booleano(titulo, defecto=False):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


ENLACE_ITEM = objeto(
    href=texto("Destino", "/"),
    texto=texto("Texto"),
    exacto=booleano("Solo la ruta exacta"),
)


def _esquema(con_campos_nuevos):
    props = dict(
        lema=texto("Lema bajo el logo"),
        enlaces={"tipo": "array", "titulo": "Enlaces", "items": ENLACE_ITEM},
        cta_href=texto("Llamada: destino", "/tienda"),
        cta_boton=texto("Llamada: boton", "Explorar productos"),
        cta_texto=texto("Llamada: texto"),
        cta_titulo=texto("Llamada: titulo"),
        nota_legal=texto("Nota legal"),
        ayuda_texto=texto("Ayuda: texto"),
        mostrar_cta=booleano("Mostrar la llamada final", True),
        ayuda_titulo=texto("Ayuda: titulo"),
        compra_titulo=texto("Columna de compra: titulo", "Compra"),
        mostrar_redes=booleano("Mostrar redes sociales", True),
        max_categorias=numero("Cuantas categorias", 4, minimo=0, maximo=10),
        navegacion_titulo=texto("Columna de navegacion: titulo"),
        mostrar_categorias=booleano("Listar categorias", True),
    )
    if con_campos_nuevos:
        props.update(
            tagline=texto(
                "Reclamo de marca",
                ayuda="Frase corta y en negrita bajo el logo. Sin ella, la columna de marca se ve como antes.",
            ),
            entrega_texto=texto(
                "Texto de reparto",
                ayuda="Linea corta con un camion al lado, ej. 'Entregas para negocios'. Vacio no la dibuja.",
            ),
            privacidad_href=texto(
                "Politica de privacidad: destino",
                ayuda="Vacio no dibuja el enlace en la barra legal.",
            ),
            privacidad_texto=texto("Politica de privacidad: texto", "Política de privacidad"),
            terminos_href=texto(
                "Terminos y condiciones: destino",
                ayuda="Vacio no dibuja el enlace en la barra legal.",
            ),
            terminos_texto=texto("Terminos y condiciones: texto", "Términos y condiciones"),
        )
    return objeto(**props)


ESQUEMA_PROPS_ANTES = _esquema(con_campos_nuevos=False)
ESQUEMA_PROPS_AHORA = _esquema(con_campos_nuevos=True)


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="pie").update(esquema_props=ESQUEMA_PROPS_AHORA)

    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    Tenant = apps.get_model("tenancy", "Tenant")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is None:
        return

    publicada = layout.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    cambiado = False
    nueva = []
    for bloque in publicada.composicion:
        if bloque.get("tipo") == "pie":
            props = {
                **bloque.get("props", {}),
                "tagline": TAGLINE,
                "lema": LEMA,
                "entrega_texto": ENTREGA_TEXTO,
                "cta_texto": CTA_TEXTO,
                "enlaces": ENLACES_EMPRESA,
            }
            bloque = {**bloque, "props": props}
            cambiado = True
        nueva.append(bloque)

    if not cambiado:
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
        nota="Pie premium: reclamo de marca, reparto y CTA separado.",
        fecha_publicacion=timezone.now(),
    )
    layout.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="pie").update(esquema_props=ESQUEMA_PROPS_ANTES)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0041_por_que_elegirnos_imagen_fondo")]

    operations = [migrations.RunPython(aplicar, revertir)]
