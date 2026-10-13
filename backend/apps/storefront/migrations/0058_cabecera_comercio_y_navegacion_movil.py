"""
La cabecera «comercio» y la navegación móvil configurable.

Lo que cambia en el catálogo de bloques (para TODOS los negocios, sin cambiar
el aspecto de ninguno):

- `cabecera` gana la variante «comercio»: franja oscura con avisos y la
  barra verde de siempre — logo, los enlaces (Inicio, Tienda, Nosotros,
  Contacto), el buscador como protagonista, «Mi cuenta» y «Mi pedido».
- Propiedades nuevas, todas con un valor por defecto que deja la cabecera
  como estaba: `mostrar_avisos`, `cuenta_modo`/`cuenta_texto`/`cuenta_href`,
  `nav_movil` (las opciones de la barra inferior, en orden) y
  `nav_movil_estilo`. El panel las dibuja solo a partir del esquema.
- «Mi cuenta» no es una casilla visual: con `cuenta_modo = automatico` sale
  solo si el negocio identifica a sus clientes (`identificacion_clientes`).
- Cinco tokens que la cabecera admite como estilo propio. Los de color van
  SIN valor por defecto, como `bloque-fondo`: mientras nadie los toque, la
  tienda usa los colores de su marca y no un verde escrito aquí.

Y para La Gran Cosecha (y su plantilla): pasa a «comercio», con dos avisos en
la franja, sin el botón «Comprar» aparte (Tienda ya es un enlace de la barra),
sin «Mi cuenta» y con la barra inferior flotante con Inicio, Tienda, Nosotros y Contacto. Buscar y
«Mi pedido» siguen en la barra de arriba también en el móvil. Como en 0053, los borradores reciben el mismo
cambio y lo publicado se archiva con una versión nueva en el historial.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"
PLANTILLA_SLUG = "la-gran-cosecha"

TIPOS_NAV = ["inicio", "buscar", "tienda", "pedido", "cuenta", "enlace"]
ICONOS_NAV = [
    "", "inicio", "buscar", "tienda", "pedido", "cuenta", "contacto", "nosotros",
    "whatsapp", "ofertas", "favoritos", "categorias", "pedidos",
]

PROPS_NUEVAS = {
    "mostrar_avisos": {
        "tipo": "boolean",
        "titulo": "Mostrar la franja superior",
        "ayuda": "La franja oscura de arriba, con los avisos y (en «Comercio») los enlaces informativos.",
        "default": True,
    },
    "cuenta_modo": {
        "tipo": "enum",
        "titulo": "«Mi cuenta»",
        "opciones": ["automatico", "oculta"],
        "opciones_etiquetas": {
            "automatico": "Automático: solo si la tienda identifica a sus clientes",
            "oculta": "Nunca",
        },
        "ayuda": "Se muestra cuando los clientes se identifican (por cédula). Con «solo nombre» no hay cuenta que consultar y se oculta sola.",
        "default": "automatico",
    },
    "cuenta_texto": {"tipo": "string", "titulo": "Texto de «Mi cuenta»", "default": "Mi cuenta"},
    "cuenta_href": {
        "tipo": "string",
        "titulo": "Destino de «Mi cuenta»",
        "default": "/tienda/mis-pedidos",
        "formato": "enlace",
    },
    "nav_movil": {
        "tipo": "array",
        "titulo": "Barra inferior del móvil (en orden)",
        "ayuda": "Vacía: los enlaces de siempre. «Cuenta» se oculta sola si la tienda no identifica clientes.",
        "items": {
            "tipo": "object",
            "properties": {
                "tipo": {
                    "tipo": "enum",
                    "titulo": "Qué hace",
                    "opciones": TIPOS_NAV,
                    "opciones_etiquetas": {
                        "inicio": "Inicio",
                        "buscar": "Abrir el buscador",
                        "tienda": "Ir a la tienda",
                        "pedido": "Ver el pedido (con contador)",
                        "cuenta": "Mi cuenta",
                        "enlace": "Otro enlace",
                    },
                    "default": "inicio",
                },
                "texto": {"tipo": "string", "titulo": "Etiqueta (vacía: la del tipo)", "default": ""},
                "icono": {
                    "tipo": "enum",
                    "titulo": "Icono",
                    "opciones": ICONOS_NAV,
                    "opciones_etiquetas": {
                        "": "El del tipo",
                        "inicio": "Casa",
                        "buscar": "Lupa",
                        "tienda": "Tienda",
                        "pedido": "Bolsa",
                        "cuenta": "Persona",
                        "contacto": "Teléfono",
                        "nosotros": "Información",
                        "whatsapp": "Mensaje",
                        "ofertas": "Descuento",
                        "favoritos": "Corazón",
                        "categorias": "Categorías",
                        "pedidos": "Lista",
                    },
                    "default": "",
                },
                "href": {
                    "tipo": "string",
                    "titulo": "Destino (solo «Otro enlace»)",
                    "default": "",
                    "formato": "enlace",
                },
            },
        },
    },
    "nav_movil_estilo": {
        "tipo": "enum",
        "titulo": "Estilo de la barra inferior",
        "opciones": ["clasica", "flotante"],
        "opciones_etiquetas": {
            "clasica": "Clásica: oscura, de borde a borde",
            "flotante": "Flotante: blanca y redondeada",
        },
        "default": "clasica",
    },
}

TITULOS_ACTUALIZADOS = {
    "cta_texto": {"titulo": "Texto del botón del pedido"},
}

VARIANTE = {"codigo": "comercio", "nombre": "Comercio: franja de avisos y buscador protagonista"}

TOKENS = [
    {
        "codigo": "navbar-avisos-fondo",
        "nombre": "Fondo de la franja superior",
        "variable_css": "--navbar-avisos-fondo",
        "valor_por_defecto": "",
        "descripcion": "Vacío: el verde más oscuro de la marca.",
        "grupo": "NAVEGACION",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 70,
    },
    {
        "codigo": "navbar-pedido-fondo",
        "nombre": "Color del botón «Mi pedido»",
        "variable_css": "--navbar-pedido-fondo",
        "valor_por_defecto": "",
        "descripcion": "También el del contador de la barra inferior. Vacío: el verde oscuro de la marca.",
        "grupo": "NAVEGACION",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 80,
    },
    {
        "codigo": "navbar-radio",
        "nombre": "Redondeo de la cabecera",
        "variable_css": "--navbar-radio",
        "valor_por_defecto": "12",
        "descripcion": "El del buscador y los botones «Tienda» y «Mi cuenta».",
        "grupo": "NAVEGACION",
        "tipo": "MEDIDA",
        "unidad": "px",
        "orden": 90,
    },
    {
        "codigo": "nav-inferior-activo",
        "nombre": "Fondo de la opción activa (móvil)",
        "variable_css": "--nav-inferior-activo",
        "valor_por_defecto": "",
        "descripcion": "La cápsula detrás del icono elegido en la barra flotante. Vacío: el verde claro de la marca.",
        "grupo": "NAVEGACION",
        "tipo": "COLOR",
        "unidad": "",
        "orden": 100,
    },
    {
        "codigo": "nav-inferior-radio",
        "nombre": "Redondeo de la barra inferior (móvil)",
        "variable_css": "--nav-inferior-radio",
        "valor_por_defecto": "22",
        "descripcion": "Solo en el estilo «Flotante».",
        "grupo": "NAVEGACION",
        "tipo": "MEDIDA",
        "unidad": "px",
        "orden": 110,
    },
]

PROPS_COSECHA = {
    "boton_texto": "",
    "cta_texto": "Mi pedido",
    "mostrar_avisos": True,
    "avisos": [
        {"texto": "Precios del día: los confirmamos al recibir tu pedido", "icono": "etiqueta", "lado": "izquierda"},
        {"texto": "Pedidos para hogares y negocios", "icono": "canasta", "lado": "izquierda"},
    ],
    # La Gran Cosecha identifica por cédula, así que «Mi cuenta» saldría sola;
    # el negocio no la quiere en la cabecera. Se puede volver a «automatico»
    # desde el panel.
    "cuenta_modo": "oculta",
    "nav_movil": [
        {"tipo": "inicio", "texto": "", "icono": "", "href": ""},
        {"tipo": "tienda", "texto": "", "icono": "", "href": ""},
        {"tipo": "enlace", "texto": "Nosotros", "icono": "nosotros", "href": "/nosotros"},
        {"tipo": "enlace", "texto": "Contacto", "icono": "contacto", "href": "/contacto"},
    ],
    "nav_movil_estilo": "flotante",
}
#: Lo que se restaura al revertir (lo que tenía antes de esta migración).
CLAVES_COSECHA = set(PROPS_COSECHA) - {"cta_texto"}


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------
def _catalogo(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    TokenTema = apps.get_model("storefront", "TokenTema")

    for datos in TOKENS:
        TokenTema.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    cabecera = Bloque.objects.filter(codigo="cabecera").first()
    if cabecera is None:
        return
    esquema = dict(cabecera.esquema_props or {})
    propiedades = dict(esquema.get("properties") or {})
    for clave, campo in PROPS_NUEVAS.items():
        propiedades.setdefault(clave, campo)
    for clave, cambios in TITULOS_ACTUALIZADOS.items():
        if clave in propiedades:
            propiedades[clave] = {**propiedades[clave], **cambios}
    esquema["properties"] = propiedades
    cabecera.esquema_props = esquema

    variantes = list(cabecera.variantes or [])
    if not any(isinstance(v, dict) and v.get("codigo") == VARIANTE["codigo"] for v in variantes):
        variantes.append(dict(VARIANTE))
    cabecera.variantes = variantes

    admitidos = list(cabecera.tokens_admitidos or [])
    for datos in TOKENS:
        if datos["codigo"] not in admitidos:
            admitidos.append(datos["codigo"])
    cabecera.tokens_admitidos = admitidos
    cabecera.save(update_fields=["esquema_props", "variantes", "tokens_admitidos"])


def _catalogo_revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    TokenTema = apps.get_model("storefront", "TokenTema")
    codigos = [t["codigo"] for t in TOKENS]

    cabecera = Bloque.objects.filter(codigo="cabecera").first()
    if cabecera is not None:
        esquema = dict(cabecera.esquema_props or {})
        propiedades = {k: v for k, v in (esquema.get("properties") or {}).items() if k not in PROPS_NUEVAS}
        esquema["properties"] = propiedades
        cabecera.esquema_props = esquema
        cabecera.variantes = [
            v for v in (cabecera.variantes or []) if not (isinstance(v, dict) and v.get("codigo") == VARIANTE["codigo"])
        ]
        cabecera.tokens_admitidos = [c for c in (cabecera.tokens_admitidos or []) if c not in codigos]
        cabecera.save(update_fields=["esquema_props", "variantes", "tokens_admitidos"])
    TokenTema.objects.filter(codigo__in=codigos).delete()


# --------------------------------------------------------------------------
# La Gran Cosecha
# --------------------------------------------------------------------------
def _a_comercio(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera" and bloque.get("variante") != "comercio":
            props = {**(bloque.get("props") or {}), **PROPS_COSECHA}
            bloque = {**bloque, "variante": "comercio", "props": props}
            cambiado = True
        nueva.append(bloque)
    return nueva if cambiado else None


def _de_comercio(composicion):
    if not isinstance(composicion, list):
        return None
    cambiado = False
    nueva = []
    for bloque in composicion:
        if isinstance(bloque, dict) and bloque.get("tipo") == "cabecera" and bloque.get("variante") == "comercio":
            props = {k: v for k, v in (bloque.get("props") or {}).items() if k not in CLAVES_COSECHA}
            props["boton_texto"] = "Comprar"
            bloque = {**bloque, "variante": "", "props": props}
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
        nueva = transformar(paginas.get("/_layout"))
        if nueva is not None:
            paginas["/_layout"] = nueva
            plantilla.paginas = paginas
            plantilla.save(update_fields=["paginas"])

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return
    layout = Pagina.objects.filter(tenant=tenant, ruta="/_layout").first()
    if layout is None:
        return

    for borrador in layout.versiones.filter(estado="BORRADOR"):
        nueva = transformar(borrador.composicion)
        if nueva is not None:
            borrador.composicion = nueva
            borrador.save(update_fields=["composicion"])

    publicada = layout.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return
    nueva = transformar(publicada.composicion)
    if nueva is None:
        return

    publicada.estado = "ARCHIVADA"
    publicada.save(update_fields=["estado"])
    ultimo_numero = layout.versiones.order_by("-numero").values_list("numero", flat=True).first() or 0
    VersionPagina.objects.create(
        tenant=tenant,
        pagina=layout,
        numero=ultimo_numero + 1,
        estado="PUBLICADA",
        composicion=nueva,
        nota=nota,
        fecha_publicacion=timezone.now(),
    )


def aplicar(apps, schema_editor):
    _catalogo(apps, schema_editor)
    _transformar(apps, _a_comercio, "Cabecera «Comercio» y barra inferior flotante (Inicio, Tienda, Nosotros, Contacto).")


def revertir(apps, schema_editor):
    _transformar(apps, _de_comercio, "Cabecera: vuelve la clásica.")
    _catalogo_revertir(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ("storefront", "0057_como_trabajamos_interactivo"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
