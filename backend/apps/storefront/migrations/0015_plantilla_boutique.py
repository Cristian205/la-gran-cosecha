"""
Dos bloques nuevos, tres variantes, y la plantilla «Belleza».

Es la segunda tienda entera compuesta desde el motor, y sirve para lo que sirve
la segunda de cualquier cosa: comprobar si lo que se escribio para la primera
era una abstraccion o solo un caso disfrazado. La medida es el reparto entre
codigo y datos, y aqui sale asi:

    componentes nuevos    2   (la franja de categorias y la pantalla de acceso)
    variantes nuevas      3   (cabecera, portada y publicos)
    tokens nuevos         1   (la tipografia de los titulos, en la 0018)
    filas de datos      todo lo demas

Ni un color escrito en el CSS. El rosa sale de que la plantilla PROPONE un
color primario —campo `marca`— y la tienda deriva su escala entera de el; las
reglas nuevas de `global.css` hablan de `--verde-500`, que es el nombre viejo
de «el color de este negocio». Si alguna hubiera codificado un rosa, la
plantilla habria dejado de ser una plantilla para ser el diseno de un cliente.

# Por que `barra-categorias` es un bloque y no una propiedad de la cabecera

La cabecera es el menu del SITIO —inicio, nosotros, contacto—; la franja es el
menu del CATALOGO. Un negocio con tres categorias no la pone y su cabecera
sigue igual; uno con doce la pone y su menu principal no crece. Metidas en el
mismo bloque, quitar una obligaria a tocar la otra.

# Por que `acceso` es un bloque y no una pagina de Next

Porque entonces seria la misma pantalla de entrada para las mil tiendas, y la
pagina de acceso es justo donde un negocio deja de parecer generico. Como
bloque se edita entera desde el constructor —el argumento de la izquierda, los
textos, los proveedores— sin desplegar nada.

Lo que ese bloque NO hace es autenticar: Crynex todavia no tiene cuentas de
comprador, y montarlas es un modulo entero, no un formulario. El bloque lo dice
en pantalla en vez de fingirlo. Ver `bloques/Acceso.tsx`.
"""
from django.db import migrations


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


def booleano(titulo, defecto=True):
    return {"tipo": "boolean", "titulo": titulo, "default": defecto}


ATAJO_ITEM = {
    "tipo": "object",
    "properties": {
        "texto": texto("Texto"),
        "href": texto("Destino", "/tienda"),
        "icono": texto("Icono", "etiqueta"),
    },
}

BLOQUES = [
    {
        "codigo": "barra-categorias",
        "nombre": "Franja de categorias",
        "categoria": "ESTRUCTURA",
        "descripcion": "Atajos con icono bajo la cabecera. Va en el armazon.",
        "icono": "layout-list",
        "orden": 2,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "franja", "nombre": "A lo ancho"},
            {"codigo": "centrada", "nombre": "Centrada"},
        ],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "enlaces": {"tipo": "array", "titulo": "Atajos", "items": ATAJO_ITEM},
                "destacado": {
                    "tipo": "object",
                    "titulo": "Atajo destacado (pildora de color)",
                    "properties": ATAJO_ITEM["properties"],
                },
            },
        },
    },
    {
        "codigo": "acceso",
        "nombre": "Pantalla de acceso",
        "categoria": "CONTENIDO",
        "descripcion": "Entrada a la cuenta, con media pagina de argumento.",
        "icono": "log-in",
        "orden": 20,
        "unico_por_pagina": True,
        "a_sangre": True,
        "requiere_datos": False,
        "variantes": [
            {"codigo": "partido", "nombre": "Partido: argumento y formulario"},
            {"codigo": "centrado", "nombre": "Solo el formulario, centrado"},
        ],
        "esquema_props": {
            "tipo": "object",
            "properties": {
                "panel_titulo": texto("Panel: titular"),
                "panel_titulo_resaltado": texto("Panel: titular resaltado"),
                "panel_texto": texto("Panel: texto"),
                "panel_imagen": texto("Panel: foto (URL)"),
                "panel_imagen_alt": texto("Panel: texto alternativo"),
                "panel_ventajas": {
                    "tipo": "array",
                    "titulo": "Panel: ventajas",
                    "items": {
                        "tipo": "object",
                        "properties": {
                            "titulo": texto("Titulo"),
                            "texto": texto("Segunda linea"),
                            "icono": texto("Icono", "hoja"),
                        },
                    },
                },
                "titulo": texto("Formulario: titulo", "Bienvenida de nuevo"),
                "texto": texto("Formulario: subtitulo"),
                "etiqueta_correo": texto("Etiqueta del correo", "Correo electrónico"),
                "marcador_correo": texto("Ejemplo del correo", "tu@correo.com"),
                "etiqueta_clave": texto("Etiqueta de la contrasena", "Contraseña"),
                "marcador_clave": texto("Ejemplo de la contrasena", "Ingresa tu contraseña"),
                "olvido_texto": texto("Enlace de contrasena olvidada"),
                "olvido_href": texto("Destino de ese enlace"),
                "boton_texto": texto("Boton", "Iniciar sesión"),
                "destino": texto("A donde se manda el formulario"),
                "aviso_sin_destino": texto(
                    "Aviso cuando no hay destino",
                    "Las cuentas de cliente todavía no están activas en esta tienda.",
                ),
                "separador_texto": texto("Texto del separador", "o continúa con"),
                "sociales": {
                    "tipo": "array",
                    "titulo": "Accesos con otro proveedor",
                    "items": {
                        "tipo": "object",
                        "properties": {
                            "proveedor": texto("Proveedor (google, facebook)", "google"),
                            "texto": texto("Texto del boton"),
                            "href": texto("URL que da el proveedor"),
                        },
                    },
                },
                "pie_texto": texto("Pie: texto"),
                "pie_enlace_texto": texto("Pie: enlace"),
                "pie_enlace_href": texto("Pie: destino del enlace"),
            },
        },
    },
]

# ==========================================================================
# LO QUE GANAN LOS BLOQUES QUE YA EXISTIAN
# ==========================================================================
#: Se ANADE a lo que cada uno tuviera. Si alguien retoco la lista desde el
#: panel de Crynex, su trabajo manda: solo se mete lo que falta.
VARIANTES_NUEVAS = {
    "cabecera": [
        {"codigo": "clasica", "nombre": "Clasica"},
        {"codigo": "boutique", "nombre": "Clara, con barra de avisos"},
    ],
    "portada": [
        {"codigo": "imagen", "nombre": "Con foto al lado"},
        {"codigo": "centrado", "nombre": "Centrado, sin foto"},
        {"codigo": "boutique", "nombre": "En tarjeta redondeada"},
    ],
    "publicos-objetivo": [
        {"codigo": "franja", "nombre": "Franja oscura"},
        {"codigo": "tarjetas", "nombre": "Tarjetas claras"},
    ],
}

#: La barra fina de arriba. Es la unica propiedad nueva de la cabecera: lo
#: demas del diseno —logo, buscador, carrito— ya lo tenia.
AVISOS_PROP = {
    "tipo": "array",
    "titulo": "Barra de avisos (arriba del todo)",
    "items": {
        "tipo": "object",
        "properties": {
            "texto": texto("Texto"),
            "icono": texto("Icono", "camion"),
            "lado": texto("Lado (izquierda o derecha)", "izquierda"),
        },
    },
}

#: Una segunda linea por ventaja de la portada. Opcional: sin ella la ventaja
#: se dibuja como siempre, asi que ninguna tienda cambia de aspecto.
VENTAJA_CON_TEXTO = {
    "tipo": "object",
    "properties": {
        "titulo": texto("Texto"),
        "texto": texto("Segunda linea"),
        "icono": texto("Icono", "hoja"),
    },
}


# ==========================================================================
# LA PLANTILLA
# ==========================================================================
#: El color de marca y la tipografia. Van en `marca` y no en tokens porque de
#: `color_primario` la tienda deriva su escala entera: escribirlo como token
#: solo tenirla un escalon y dejaria los otros ocho del color anterior.
MARCA = {
    "color_primario": "#c2687e",
    "color_primario_texto": "#ffffff",
    "color_secundario": "#e9b8c6",
    "color_secundario_texto": "#3d2b31",
    "color_fondo": "#fdf5f7",
    "color_superficie": "#ffffff",
    "color_texto": "#3d2b31",
    "fuente": "jakarta",
    "radio_boton": "suave",
}

#: Lo que se ajusta con el catalogo de tokens. Cada clave es un `TokenTema`
#: sembrado; una que no exista se ignora al resolver, no rompe nada.
TOKENS = {
    # La cabecera del diseno es clara y solida, no la barra oscura translucida
    # de la tienda de siempre.
    "navbar-fondo": "#ffffff",
    "navbar-fondo-2": "#ffffff",
    "navbar-texto": "#3d2b31",
    "navbar-opacidad": "1",
    "navbar-desenfoque": "0",
    "navbar-alto": "70",
    "color-borde": "#f2dfe5",
    "footer-fondo": "#4a2f38",
    "footer-texto": "#ffffff",
    "radio-tarjeta": "18",
    # El titular en serif y sin negrita es lo que mas separa esta plantilla de
    # La Gran Cosecha, y no es CSS de esta plantilla: es el token
    # `fuente-titulos`, que siembra la 0018. Que se declare aqui antes de que el
    # token exista no importa —`tema_valores` es JSON inerte y `resolver()`
    # descarta lo que no este en el catalogo en el momento de leerlo—, y para
    # cuando alguien abra una tienda las dos migraciones habran corrido.
    "fuente-titulos": "playfair",
    "titulo-peso": "600",
    "titulo-escala": "1.05",
    "seccion-espacio": "3",
    # Editorial: foto grande, nombre debajo, precio discreto. Es el aspecto
    # para el que se escribio la variante en la fase 11.
    "estilo-tarjeta": "editorial",
    # Una boutique ensena poco y bien: mas aire y una columna menos que una
    # ferreteria. Es justo la decision que los tokens de densidad existen para
    # poder tomar sin escribir una segunda hoja de estilos.
    "densidad-escala": "1.15",
    "columnas-catalogo": "4",
}

MENU = [
    {"texto": "Inicio", "href": "/", "exacto": True},
    {"texto": "Tienda", "href": "/tienda", "exacto": False},
    {"texto": "Nosotros", "href": "/nosotros", "exacto": False},
    {"texto": "Contacto", "href": "/contacto", "exacto": False},
]

AVISOS = [
    {"texto": "Envíos rápidos a todo el país", "icono": "camion", "lado": "izquierda"},
    {"texto": "Productos 100% originales", "icono": "escudo", "lado": "izquierda"},
    {"texto": "Atención personalizada", "icono": "soporte", "lado": "derecha"},
    {"texto": "Mi cuenta", "icono": "usuario", "lado": "derecha"},
]

CATEGORIAS = [
    {"texto": "Cuidado facial", "href": "/tienda", "icono": "gotas"},
    {"texto": "Maquillaje", "href": "/tienda", "icono": "pincel"},
    {"texto": "Cuidado capilar", "href": "/tienda", "icono": "tijeras"},
    {"texto": "Cuidado corporal", "href": "/tienda", "icono": "bano"},
    {"texto": "Fragancias", "href": "/tienda", "icono": "perfume"},
    {"texto": "Accesorios", "href": "/tienda", "icono": "joya"},
    {"texto": "Marcas", "href": "/tienda", "icono": "etiqueta"},
]

ARMAZON = [
    {
        "tipo": "cabecera",
        "variante": "boutique",
        "props": {
            "enlaces": MENU,
            "mostrar_buscador": True,
            "cta_texto": "Mi carrito",
            "avisos": AVISOS,
        },
    },
    {
        "tipo": "barra-categorias",
        "variante": "franja",
        "props": {
            "enlaces": CATEGORIAS,
            "destacado": {"texto": "Promociones", "href": "/tienda", "icono": "descuento"},
        },
    },
    {
        "tipo": "pie",
        "variante": "",
        "props": {
            "mostrar_cta": True,
            "cta_titulo": "¿Lista para cuidarte mejor?",
            "cta_texto": "Descubre los productos que se adaptan a tu piel y a tu rutina.",
            "cta_boton": "Ver la tienda",
            "cta_href": "/tienda",
            "lema": "Productos de belleza seleccionados para realzar tu belleza natural.",
            "ayuda_titulo": "¿Necesitas ayuda para elegir?",
            "ayuda_texto": "Escríbenos y te recomendamos lo que mejor va contigo.",
            "compra_titulo": "Compra",
            "mostrar_categorias": True,
            "max_categorias": 6,
            "navegacion_titulo": "La tienda",
            "enlaces": MENU,
            "mostrar_redes": True,
        },
    },
]

PORTADA = {
    "kicker": "Tu belleza, nuestra pasión",
    "titulo": "Descubre tu",
    "titulo_resaltado": "mejor versión",
    "texto": (
        "Productos de belleza seleccionados para realzar tu belleza natural "
        "todos los días."
    ),
    "cta_texto": "Comprar ahora",
    "cta_href": "/tienda",
    "cta2_texto": "Ver categorías",
    "cta2_href": "/tienda",
    "imagen": "",
    "imagen_alt": "Crema, sérum y perfume sobre una base de piedra con flores",
    "tarjeta_titulo": "",
    "tarjeta_texto": "",
    "tarjeta_icono": "flor",
    "ventajas": [
        {"titulo": "Envíos rápidos", "texto": "A todo el país", "icono": "camion"},
        {"titulo": "Productos originales", "texto": "Garantía de calidad", "icono": "escudo"},
        {"titulo": "Compra segura", "texto": "Tus datos protegidos", "icono": "candado"},
    ],
}

VALORES = {
    "titulo": "",
    "publicos": [
        {
            "titulo": "Marcas confiables",
            "texto": "Trabajamos con las mejores marcas del mundo.",
            "icono": "joya",
        },
        {
            "titulo": "Ingredientes de calidad",
            "texto": "Fórmulas seguras que cuidan tu piel y tu cabello.",
            "icono": "hoja",
        },
        {
            "titulo": "Para cada tipo de belleza",
            "texto": "Productos para cada necesidad y estilo.",
            "icono": "corazon",
        },
        {
            "titulo": "Belleza consciente",
            "texto": "No testamos en animales y cuidamos del planeta.",
            "icono": "conejo",
        },
    ],
}

HOME = [
    {"tipo": "portada", "variante": "boutique", "props": PORTADA},
    {"tipo": "publicos-objetivo", "variante": "tarjetas", "props": VALORES},
    {
        "tipo": "productos-destacados",
        "variante": "rejilla",
        "props": {"titulo": "Lo más amado", "subtitulo": "Los favoritos de nuestras clientas"},
    },
    {"tipo": "categorias-destacadas", "variante": "rejilla", "props": {}},
    {"tipo": "ofertas-semana", "variante": "", "props": {}},
    {"tipo": "testimonios", "variante": "", "props": {}},
    {
        "tipo": "cta-banda",
        "variante": "",
        "props": {
            "titulo": "Empieza tu rutina hoy",
            "texto": "Elige lo que tu piel necesita y recíbelo en casa.",
            "boton_texto": "Ver la tienda",
            "boton_href": "/tienda",
        },
    },
]

ENTRAR = [
    {
        "tipo": "acceso",
        "variante": "partido",
        "props": {
            "panel_titulo": "Belleza que te hace",
            "panel_titulo_resaltado": "brillar",
            "panel_texto": (
                "Productos de belleza seleccionados para cuidar de ti, todos los días."
            ),
            "panel_imagen": "",
            "panel_imagen_alt": "Productos de cuidado facial sobre una base de piedra",
            "panel_ventajas": [
                {"titulo": "Ingredientes", "texto": "de calidad", "icono": "hoja"},
                {"titulo": "Para cada tipo", "texto": "de belleza", "icono": "perfume"},
                {"titulo": "Cuidado que se nota", "texto": "y se siente", "icono": "corazon"},
                {"titulo": "No probado", "texto": "en animales", "icono": "conejo"},
            ],
            "titulo": "Bienvenida de nuevo",
            "texto": "Ingresa a tu cuenta para continuar",
            "etiqueta_correo": "Correo electrónico",
            "marcador_correo": "tu@correo.com",
            "etiqueta_clave": "Contraseña",
            "marcador_clave": "Ingresa tu contraseña",
            "olvido_texto": "¿Olvidaste tu contraseña?",
            "olvido_href": "/contacto",
            "boton_texto": "Iniciar sesión",
            # Vacio a proposito: no hay a donde mandarlo todavia. El bloque lo
            # dice en pantalla en vez de fingir que inicia sesion.
            "destino": "",
            "separador_texto": "o continúa con",
            # Sin URL no se dibujan. Las da el proveedor cuando el negocio
            # configura su acceso; hasta entonces, dos botones muertos.
            "sociales": [
                {"proveedor": "google", "texto": "Continuar con Google", "href": ""},
                {"proveedor": "facebook", "texto": "Continuar con Facebook", "href": ""},
            ],
            "pie_texto": "¿No tienes una cuenta?",
            "pie_enlace_texto": "Regístrate aquí",
            "pie_enlace_href": "/contacto",
        },
    },
]


def normalizar(bruto, indice):
    return {
        "id": f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def componer(lista):
    return [normalizar(b, i) for i, b in enumerate(lista)]


def sembrar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")

    for datos in BLOQUES:
        Bloque.objects.get_or_create(
            codigo=datos["codigo"],
            defaults={k: v for k, v in datos.items() if k != "codigo"},
        )

    # --- las variantes nuevas de los bloques que ya estaban -------------
    for codigo, variantes in VARIANTES_NUEVAS.items():
        bloque = Bloque.objects.filter(codigo=codigo).first()
        if bloque is None:
            continue
        existentes = {v.get("codigo") for v in (bloque.variantes or [])}
        faltan = [v for v in variantes if v["codigo"] not in existentes]
        if faltan:
            bloque.variantes = [*(bloque.variantes or []), *faltan]
            bloque.save(update_fields=["variantes"])

    # --- la barra de avisos, como propiedad de la cabecera --------------
    cabecera = Bloque.objects.filter(codigo="cabecera").first()
    if cabecera is not None:
        esquema = dict(cabecera.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        propiedades.setdefault("avisos", AVISOS_PROP)
        esquema["properties"] = propiedades
        cabecera.esquema_props = esquema
        cabecera.save(update_fields=["esquema_props"])

    # --- la segunda linea de las ventajas de la portada -----------------
    portada = Bloque.objects.filter(codigo="portada").first()
    if portada is not None:
        esquema = dict(portada.esquema_props or {})
        propiedades = dict(esquema.get("properties") or {})
        ventajas = dict(propiedades.get("ventajas") or {})
        ventajas["items"] = VENTAJA_CON_TEXTO
        propiedades["ventajas"] = ventajas
        esquema["properties"] = propiedades
        portada.esquema_props = esquema
        portada.save(update_fields=["esquema_props"])

    Plantilla.objects.get_or_create(
        slug="belleza",
        defaults={
            "nombre": "Belleza",
            "descripcion": (
                "Cabecera clara con barra de avisos, franja de categorias, portada "
                "en tarjeta y pantalla de acceso. Para boutiques y tiendas de "
                "cuidado personal."
            ),
            "sector": "Belleza",
            "paginas": {
                "/_layout": componer(ARMAZON),
                "/": componer(HOME),
                "/entrar": componer(ENTRAR),
            },
            "tema_valores": TOKENS,
            "marca": MARCA,
            "activa": True,
            "es_predeterminada": False,
            "orden": 8,
        },
    )


def retirar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")

    Plantilla.objects.filter(slug="belleza").delete()
    # Los bloques se desactivan en vez de borrarse: una pagina publicada puede
    # tenerlos colocados, y borrar la fila dejaria esa composicion nombrando
    # algo que ya no existe. Retirar es archivar.
    Bloque.objects.filter(codigo__in=[b["codigo"] for b in BLOQUES]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0014_marca_de_plantilla")]

    operations = [migrations.RunPython(sembrar, retirar)]
