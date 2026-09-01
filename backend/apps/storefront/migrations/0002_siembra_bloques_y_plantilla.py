"""
Siembra el catalogo de bloques y convierte la home actual en datos.

El catalogo no se inventa: cada bloque de aqui declara un componente que YA
existe en `frontend/tienda/src/componentes`. Esta migracion no anade capacidad
nueva a la tienda, la hace configurable.

El paso importante es el tercero. Hasta ahora el orden de las secciones del
inicio estaba escrito a mano en `HomePage.tsx` y los textos vivian en doce
columnas de `StoreSettings` (`paso1_titulo`, `cta_final_texto`...). Aqui se
copian a las propiedades de sus bloques y la composicion queda PUBLICADA, de
modo que la tienda se ve exactamente igual que antes pero leida de datos.

Las doce columnas NO se borran todavia: se quedan como estaban hasta que la
tienda nueva este servida en produccion. Retirarlas es la fase siguiente, y
tiene que ser un paso reversible por su cuenta.
"""
from django.db import migrations

CATEGORIA = "CATEGORIA"


def bloque(codigo, nombre, categoria, descripcion, **extra):
    return {
        "codigo": codigo,
        "nombre": nombre,
        "categoria": categoria,
        "descripcion": descripcion,
        "esquema_props": extra.get("props", {}),
        "variantes": extra.get("variantes", []),
        "requiere_datos": extra.get("requiere_datos", False),
        "unico_por_pagina": extra.get("unico", False),
        "a_sangre": extra.get("a_sangre", False),
        "orden": extra.get("orden", 0),
    }


def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


CATALOGO = [
    bloque(
        "carrusel-promociones",
        "Carrusel de promociones",
        "ESTRUCTURA",
        "Las banderolas del negocio, en rotacion automatica.",
        orden=10,
        unico=True,
        a_sangre=True,
        variantes=[
            {"codigo": "completo", "nombre": "Ancho completo"},
            {"codigo": "contenido", "nombre": "Dentro del contenedor"},
        ],
        props={
            "tipo": "object",
            "properties": {
                "autoplay": {"tipo": "boolean", "titulo": "Rotar solo", "default": True},
                "segundos": {"tipo": "number", "titulo": "Segundos por banderola", "default": 6},
            },
        },
    ),
    bloque(
        "insignias-confianza",
        "Insignias de confianza",
        "PRUEBA_SOCIAL",
        "Franja con las garantias del negocio.",
        orden=20,
    ),
    bloque(
        "repetir-pedido",
        "Repetir pedido",
        "CONVERSION",
        "Atajo para quien ya compro antes.",
        orden=30,
        unico=True,
    ),
    bloque(
        "productos-destacados",
        "Productos destacados",
        "CATALOGO",
        "Los mas vendidos, resueltos en el servidor para que los indexe el buscador.",
        orden=40,
        requiere_datos=True,
        variantes=[
            {"codigo": "rejilla", "nombre": "Rejilla"},
            {"codigo": "carrusel", "nombre": "Carrusel"},
        ],
        props={
            "tipo": "object",
            "properties": {
                "titulo": texto("Titulo", "Lo mas vendido"),
                "limite": {"tipo": "number", "titulo": "Cuantos productos", "default": 8},
            },
        },
    ),
    bloque(
        "ofertas-semana",
        "Ofertas de la semana",
        "CATALOGO",
        "Los productos con oferta vigente.",
        orden=50,
    ),
    bloque(
        "categorias-destacadas",
        "Categorias destacadas",
        "CATALOGO",
        "Accesos directos a las categorias del catalogo.",
        orden=60,
        variantes=[
            {"codigo": "rejilla", "nombre": "Rejilla"},
            {"codigo": "tiras", "nombre": "Tiras horizontales"},
        ],
    ),
    bloque(
        "por-que-elegirnos",
        "Por que elegirnos",
        "CONTENIDO",
        "Los beneficios comerciales que el negocio administra.",
        orden=70,
    ),
    bloque(
        "estadisticas",
        "Estadisticas de confianza",
        "PRUEBA_SOCIAL",
        "Cifras del negocio: clientes, pedidos, anios.",
        orden=80,
    ),
    bloque(
        "testimonios",
        "Testimonios",
        "PRUEBA_SOCIAL",
        "Lo que dicen los clientes.",
        orden=90,
    ),
    bloque(
        "como-funciona",
        "Como funciona",
        "CONTENIDO",
        "Los pasos para comprar. El numero de pasos ya no es fijo.",
        orden=100,
        props={
            "tipo": "object",
            "properties": {
                "kicker": texto("Antetitulo", "Como funciona"),
                "titulo": texto("Titulo", "Pedir es simple"),
                "subtitulo": texto("Subtitulo"),
                "pasos": {
                    "tipo": "array",
                    "titulo": "Pasos",
                    "items": {
                        "tipo": "object",
                        "properties": {
                            "titulo": texto("Titulo"),
                            "texto": texto("Texto"),
                            "icono": texto("Icono", "search"),
                        },
                    },
                },
            },
        },
    ),
    bloque(
        "cotizacion-rapida",
        "Cotizacion rapida",
        "CONVERSION",
        "Formulario para pedidos grandes o fuera de catalogo.",
        orden=110,
        unico=True,
        props={
            "tipo": "object",
            "properties": {
                "titulo": texto("Titulo"),
                "texto": texto("Texto"),
            },
        },
    ),
    bloque(
        "cta-banda",
        "Banda de llamada a la accion",
        "CONVERSION",
        "Franja final con un boton.",
        orden=120,
        props={
            "tipo": "object",
            "properties": {
                "titulo": texto("Titulo"),
                "texto": texto("Texto"),
                "boton_texto": texto("Texto del boton", "Ir a la tienda"),
                "boton_href": texto("Enlace del boton", "/tienda"),
            },
        },
    ),
]


#: El orden exacto que tenia `HomePage.tsx`. Los textos se rellenan despues
#: desde la configuracion de cada negocio.
HOME = [
    {"tipo": "carrusel-promociones", "variante": "completo"},
    {"tipo": "insignias-confianza"},
    {"tipo": "repetir-pedido"},
    {"tipo": "productos-destacados", "variante": "rejilla", "props": {"limite": 8}},
    {"tipo": "ofertas-semana"},
    {"tipo": "categorias-destacadas", "variante": "rejilla"},
    {"tipo": "por-que-elegirnos"},
    {"tipo": "estadisticas"},
    {"tipo": "testimonios"},
    {
        "tipo": "como-funciona",
        # La plantilla trae textos por defecto porque es el arranque de un
        # negocio que aun no ha escrito los suyos. Un "Como funciona" sin pasos
        # no se pinta, y la tienda nueva saldria con un hueco.
        "props": {
            "kicker": "Como funciona",
            "titulo": "Pedir es simple",
            "subtitulo": "De la busqueda a la entrega en tres pasos",
            "pasos": [
                {
                    "titulo": "Explora el catalogo",
                    "texto": "Filtra por categoria o busca directo lo que necesitas.",
                    "icono": "search",
                },
                {
                    "titulo": "Arma tu pedido",
                    "texto": "Elige presentacion, unidad y cantidad.",
                    "icono": "clipboard",
                },
                {
                    "titulo": "Recibe tu entrega",
                    "texto": "Confirmamos contigo y despachamos.",
                    "icono": "truck",
                },
            ],
        },
    },
    {
        "tipo": "cotizacion-rapida",
        "props": {
            "titulo": "Pedido grande o fuera de catalogo?",
            "texto": "Cuentanos que necesitas y te confirmamos precio y disponibilidad.",
        },
    },
    {
        "tipo": "cta-banda",
        "props": {
            "titulo": "Tu proximo pedido puede estar en camino hoy mismo",
            "texto": "Explora el catalogo completo y arma tu pedido en minutos.",
            "boton_texto": "Ir a la tienda",
            "boton_href": "/tienda",
        },
    },
]

ICONOS_PASO = ["search", "clipboard", "truck"]


def sembrar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Plantilla = apps.get_model("storefront", "Plantilla")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    # --- 1. el catalogo de bloques -------------------------------------
    for datos in CATALOGO:
        Bloque.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    # --- 2. la plantilla de arranque -----------------------------------
    Plantilla.objects.get_or_create(
        slug="mercado",
        defaults={
            "nombre": "Mercado",
            "descripcion": "Catalogo amplio, pedidos por mayor y prueba social.",
            "sector": "Alimentos",
            "paginas": {"/": [normalizar(b, i) for i, b in enumerate(HOME)]},
            "activa": True,
            "es_predeterminada": True,
        },
    )

    # --- 3. la home de cada negocio que ya existe ----------------------
    for tenant in Tenant.objects.all():
        config = StoreSettings.objects.filter(tenant=tenant).first()

        pagina, creada = Pagina.objects.get_or_create(
            tenant=tenant,
            ruta="/",
            defaults={"titulo": "Inicio", "tipo": "HOME"},
        )
        if not creada and pagina.versiones.exists():
            continue  # ya tiene composicion; no se pisa

        VersionPagina.objects.create(
            tenant=tenant,
            pagina=pagina,
            numero=1,
            estado="PUBLICADA",
            composicion=componer_home(config),
            nota="Trasladada de HomePage.tsx.",
            fecha_publicacion=None,
        )


def normalizar(bruto, indice):
    """Da a cada bloque la forma completa que el lienzo espera."""
    return {
        "id": f"{bruto['tipo']}-{indice}",
        "tipo": bruto["tipo"],
        "variante": bruto.get("variante", ""),
        "props": bruto.get("props", {}),
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }


def componer_home(config):
    """
    La home del negocio, con sus textos ya dentro de los bloques.

    Es el traslado que da sentido a todo: los doce campos de copy que vivian en
    columnas pasan a ser propiedades de los bloques que los usan. A partir de
    aqui, un cuarto paso en "Como funciona" es un elemento mas en una lista y
    no una migracion.
    """
    bloques = [normalizar(b, i) for i, b in enumerate(HOME)]
    if config is None:
        return bloques

    por_tipo = {b["tipo"]: b for b in bloques}

    pasos = []
    for n in (1, 2, 3):
        titulo = getattr(config, f"paso{n}_titulo", "") or ""
        cuerpo = getattr(config, f"paso{n}_texto", "") or ""
        if titulo or cuerpo:
            pasos.append(
                {"titulo": titulo, "texto": cuerpo, "icono": ICONOS_PASO[n - 1]}
            )
    por_tipo["como-funciona"]["props"] = {
        "kicker": "Como funciona",
        "titulo": "Pedir es simple",
        "subtitulo": "De la busqueda a tu bodega en tres pasos",
        "pasos": pasos,
    }

    por_tipo["cotizacion-rapida"]["props"] = {
        "titulo": getattr(config, "cotizacion_titulo", "") or "",
        "texto": getattr(config, "cotizacion_texto", "") or "",
    }

    por_tipo["cta-banda"]["props"] = {
        "titulo": getattr(config, "cta_final_titulo", "") or "",
        "texto": getattr(config, "cta_final_texto", "") or "",
        "boton_texto": "Ir a la tienda",
        "boton_href": "/tienda",
    }

    return bloques


def revertir(apps, schema_editor):
    """
    Retira el catalogo sembrado, pero NO las paginas de los negocios.

    Una composicion editada por un cliente es trabajo suyo; deshacer una
    migracion de esquema no deberia llevarselo por delante.
    """
    apps.get_model("storefront", "Bloque").objects.filter(
        codigo__in=[b["codigo"] for b in CATALOGO]
    ).delete()
    apps.get_model("storefront", "Plantilla").objects.filter(slug="mercado").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("storefront", "0001_motor_de_tiendas"),
        ("content", "0001_initial"),
        ("tenancy", "0001_initial"),
    ]

    operations = [migrations.RunPython(sembrar, revertir)]
