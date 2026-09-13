"""
Nuevo bloque "texto-libre" (prosa genérica: historia, misión, política...) y
lo agrega a la composición actual de "/nosotros" de La Gran Cosecha.

# Por qué hacía falta el bloque

El motor no tenía ningún bloque de prosa libre: `AboutPage.tsx` (el respaldo
que se pinta cuando un negocio no tiene "/nosotros" compuesto) sabe mostrar
`StoreSettings.historia`/`.mision`, pero esos dos campos no tenían forma de
llegar a una página YA compuesta con bloques —como es ahora "/nosotros" de
este tenant— porque ningún bloque del catálogo los lee. "texto-libre" es
genérico (kicker/título/una lista de sub-bloques con su propio título y
texto) para que cualquier tienda lo reutilice con su propia prosa, igual que
`Portada` o `PorQueElegirnos`.

# Por qué no se reescribe el texto

`StoreSettings.historia`/`.mision` de este tenant ya tienen contenido (no
estaban vacíos: la migración `content.0021` que iba a sembrarlos no encontró
nada que hacer). Esta migración los LEE y los coloca en el bloque nuevo, no
inventa una redacción distinta.

# Por qué se lee la composición en vez de reescribirla a mano

A diferencia de `0028_home_landing_comercial` (que reemplaza la composición
entera), "/nosotros" ya tiene una composición propia publicada aparte —hero,
beneficios, estadísticas, testimonios, cierre— que esta migración no conoce
de antemano ni quiere pisar. Se lee la versión PUBLICADA tal cual está en el
momento de aplicar la migración, se inserta el bloque nuevo justo después de
la portada, y se publica como versión siguiente. Si el negocio no tiene
"/nosotros" compuesto todavía (no debería ser el caso, pero por si acaso),
la migración no hace nada: no le corresponde inventarle una página entera.
"""
from django.db import migrations
from django.utils import timezone

TENANT_SLUG = "la-gran-cosecha"

def texto(titulo, defecto=""):
    return {"tipo": "string", "titulo": titulo, "default": defecto}


BLOQUE_CATALOGO = {
    "codigo": "texto-libre",
    "nombre": "Texto libre",
    "categoria": "CONTENIDO",
    "descripcion": "Una o dos columnas de prosa: historia, misión, política, lo que el negocio quiera contar.",
    "icono": "file-text",
    "esquema_props": {
        "tipo": "object",
        "properties": {
            "kicker": texto("Antetítulo"),
            "titulo": texto("Título"),
            "subtitulo": texto("Subtítulo"),
            "bloques": {
                "tipo": "array",
                "titulo": "Bloques de texto",
                "items": {
                    "tipo": "object",
                    "properties": {
                        "titulo": texto("Título del bloque"),
                        "texto": texto("Texto"),
                    },
                },
            },
        },
    },
    "variantes": [
        {"codigo": "una-columna", "nombre": "Una columna"},
        {"codigo": "dos-columnas", "nombre": "Dos columnas"},
    ],
    "requiere_datos": False,
    "unico_por_pagina": False,
    "a_sangre": False,
    "orden": 25,
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Pagina = apps.get_model("storefront", "Pagina")
    VersionPagina = apps.get_model("storefront", "VersionPagina")
    StoreSettings = apps.get_model("content", "StoreSettings")
    Tenant = apps.get_model("tenancy", "Tenant")

    Bloque.objects.get_or_create(codigo=BLOQUE_CATALOGO["codigo"], defaults=BLOQUE_CATALOGO)

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    config = StoreSettings.objects.filter(tenant=tenant).first()
    if config is None or not (config.historia or config.mision):
        return

    pagina = Pagina.objects.filter(tenant=tenant, ruta="/nosotros").first()
    if pagina is None:
        return

    publicada = pagina.versiones.filter(estado="PUBLICADA").first()
    if publicada is None:
        return

    composicion = list(publicada.composicion or [])
    if any(b.get("tipo") == "texto-libre" for b in composicion):
        return  # ya se agregó antes; no duplicar en un re-run.

    sub_bloques = []
    if config.historia:
        sub_bloques.append({"titulo": "Nuestra historia", "texto": config.historia})
    if config.mision:
        sub_bloques.append({"titulo": "Nuestra misión", "texto": config.mision})

    bloque_nuevo = {
        "id": "texto-libre-historia",
        "tipo": "texto-libre",
        "variante": "dos-columnas" if len(sub_bloques) > 1 else "una-columna",
        "props": {"kicker": "Quiénes somos", "bloques": sub_bloques},
        "visible": {"movil": True, "tablet": True, "escritorio": True},
    }

    # Justo después de la portada (posición 1): antes de vender beneficios o
    # mostrar prueba social, primero se cuenta quiénes son.
    indice_insercion = 1 if composicion and composicion[0].get("tipo") == "portada" else 0
    composicion.insert(indice_insercion, bloque_nuevo)

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
        composicion=composicion,
        nota="Agrega historia y misión, leídas de la configuración del negocio.",
        fecha_publicacion=timezone.now(),
    )

    pagina.versiones.filter(estado="BORRADOR").delete()


def revertir(apps, schema_editor):
    # Deliberadamente no hace nada, mismo criterio que 0028: revertir
    # sobrescribiria en silencio cualquier ajuste que el negocio haya hecho
    # desde el panel despues de publicar este cambio.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0042_pie_premium"),
        ("content", "0021_historia_y_mision_gran_cosecha"),
    ]

    operations = [migrations.RunPython(aplicar, revertir)]
