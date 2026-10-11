"""
`0057_como_trabajamos_interactivo`: esquema de capítulos con foto de móvil y
texto alternativo, y el guion nuevo sin pisar lo reescrito a mano.
"""
import importlib

import pytest

from apps.storefront.models import Bloque

pytestmark = pytest.mark.django_db

migracion = importlib.import_module("apps.storefront.migrations.0057_como_trabajamos_interactivo")


def test_el_esquema_declara_movil_alt_e_intervalo():
    props = Bloque.objects.get(codigo="historia-marca").esquema_props["properties"]
    capitulo = props["capitulos"]["items"]["properties"]
    assert capitulo["imagen_movil"]["formato"] == "imagen"
    assert "alt" in capitulo and "enfoque_movil" in capitulo
    assert props["intervalo"]["default"] == 7


def test_el_guion_solo_reemplaza_textos_anteriores_y_conserva_fotos():
    composicion = [
        {
            "id": "h",
            "tipo": "historia-marca",
            "props": {
                "capitulos": [
                    {"etiqueta": "La selección", "titulo": "Madrugamos para elegir lo mejor.", "imagen": "/a.jpg"},
                    {"etiqueta": "La entrega", "titulo": "Lo escribí yo", "imagen": "/b.jpg"},
                ]
            },
        }
    ]
    nueva = migracion._con_guion(composicion)
    capitulos = nueva[0]["props"]["capitulos"]
    assert capitulos[0]["titulo"] == "Elegimos lo que merece llegar a ti."
    assert capitulos[0]["imagen"] == "/a.jpg"
    assert capitulos[1]["titulo"] == "Lo escribí yo"
    assert migracion._con_guion(nueva) is None
