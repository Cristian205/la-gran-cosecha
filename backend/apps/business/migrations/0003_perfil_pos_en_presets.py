"""
Los dos presets aprenden a describir su caja.

Es lo que demuestra que el POS es UNO y configurable, y no dos POS: las mismas
cuatro zonas, dos configuraciones opuestas, cero ramas de codigo.

    mercado      rejilla por categorias, con foto, sin atributos por linea.
                 Se pesa la fruta y se cobra; no hay tallas que preguntar.

    ferreteria   campo de codigo de barras, sin fotos, con empaque por linea.
                 El cajero tiene el lector en la mano y trescientas referencias
                 que no distingue de vista.

Solo se tocan los presets que siguen en su version original. Un preset que
Crynex ya haya retocado a mano no se pisa: lo que esta migracion trae es un
valor por defecto que faltaba, no una correccion.
"""
from django.db import migrations

PERFILES = {
    "mercado": {
        "busqueda": "categorias",
        "muestra_imagenes": True,
        "pide_atributos_en_linea": False,
        "permite_nota_por_linea": True,
        "panel_lateral": "cliente",
    },
    "ferreteria": {
        "busqueda": "codigo_barras",
        "muestra_imagenes": False,
        "pide_atributos_en_linea": True,
        "permite_nota_por_linea": False,
        "panel_lateral": "cliente",
    },
}

#: La ferreteria cobra en mostrador, asi que el POS le pertenece. El mercado no:
#: su canal es la tienda online, y sugerirle una caja que no va a usar solo
#: haria que el alta le encendiera un modulo de mas.
MODULO_POS = {"ferreteria"}


def sembrar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")

    for slug, perfil in PERFILES.items():
        preset = Preset.objects.filter(slug=slug).first()
        if preset is None or preset.perfil_pos:
            # Ya tiene uno: alguien lo configuro desde el panel y manda el suyo.
            continue

        preset.perfil_pos = perfil
        if slug in MODULO_POS and "pos" not in (preset.modulos or []):
            preset.modulos = [*(preset.modulos or []), "pos"]
        # La version sube porque el preset cambio: es lo que permitira saber
        # con cual nacio cada negocio cuando dos del mismo sector difieran.
        preset.version += 1
        preset.save(update_fields=["perfil_pos", "modulos", "version"])


def retirar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    for slug in PERFILES:
        preset = Preset.objects.filter(slug=slug).first()
        if preset is None:
            continue
        preset.perfil_pos = {}
        preset.modulos = [m for m in (preset.modulos or []) if m != "pos"]
        preset.save(update_fields=["perfil_pos", "modulos"])


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0002_siembra_presets"),
        # El modulo tiene que existir en el catalogo antes de que un preset lo
        # recomiende: `activar_modulos` lo busca por slug y lo saltaria.
        ("billing", "0007_producto_pos"),
    ]

    operations = [migrations.RunPython(sembrar, retirar)]
