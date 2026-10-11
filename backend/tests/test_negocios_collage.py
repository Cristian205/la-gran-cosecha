"""
`0055_negocios_collage`: la campaña para negocios admite un collage y La Gran
Cosecha lo estrena, sin tocar el resto de la página.
"""
import importlib

import pytest

from apps.storefront.models import Bloque, Plantilla

pytestmark = pytest.mark.django_db

migracion = importlib.import_module("apps.storefront.migrations.0055_negocios_collage")


def test_el_esquema_declara_collage_beneficios_y_logo():
    props = Bloque.objects.get(codigo="campana-negocios").esquema_props["properties"]
    assert props["collage"]["items"]["properties"]["imagen"]["formato"] == "imagen"
    assert props["beneficios"]["items"]["properties"]["icono"]["tipo"] == "enum"
    assert props["mostrar_logo"]["default"] is False


def test_la_plantilla_de_la_gran_cosecha_trae_el_collage():
    plantilla = Plantilla.objects.filter(slug="la-gran-cosecha").first()
    if plantilla is None:
        pytest.skip("La plantilla no se siembra en esta base.")
    negocios = [b for b in plantilla.paginas["/"] if b["tipo"] == "campana-negocios"]
    assert negocios, "La Home de la plantilla perdió la campaña para negocios."
    props = negocios[0]["props"]
    assert len(props["collage"]) == 5
    assert all(f["alt"] for f in props["collage"])
    assert props["cta_href"] == "/tienda"


def test_solo_cambia_el_bloque_de_negocios_y_no_repite():
    otro = {"id": "h", "tipo": "hero-campana", "props": {"titulo": "Hola"}}
    negocios = {"id": "n", "tipo": "campana-negocios", "props": {"titulo": "Antes", "ancla": "negocios"}}
    nueva = migracion._con_collage([otro, negocios])
    assert nueva[0] == otro
    assert nueva[1]["props"]["ancla"] == "negocios"
    assert nueva[1]["props"]["titulo"] == "Todo lo fresco que necesitas."
    assert migracion._con_collage(nueva) is None


marco = importlib.import_module("apps.storefront.migrations.0056_negocios_marco_y_chips")


def test_el_esquema_declara_marco_y_chips():
    props = Bloque.objects.get(codigo="campana-negocios").esquema_props["properties"]
    assert props["mostrar_marco"]["default"] is False
    item = props["collage"]["items"]["properties"]
    assert item["etiqueta"]["tipo"] == "string"
    assert "cubiertos" in item["icono"]["opciones"]


def test_marco_y_chips_respetan_lo_puesto_a_mano():
    negocios = migracion._con_collage([{"id": "n", "tipo": "campana-negocios", "props": {"titulo": "x"}}])
    negocios[0]["props"]["collage"][1]["etiqueta"] = "Cocinas"
    nueva = marco._con_marco(negocios)
    fotos = nueva[0]["props"]["collage"]
    assert nueva[0]["props"]["mostrar_marco"] is True
    assert fotos[0]["etiqueta"] == "Para tu hogar"
    assert fotos[1]["etiqueta"] == "Cocinas"
    assert fotos[3]["etiqueta"] == "Fruvers y fruterías"
    assert marco._con_marco(nueva) is None
