"""
Los más vendidos como carrusel (migración storefront/0049).

Protege que el cambio de propiedades no rompa la composición y que el Home
deje de saltarse productos: "los 5 más vendidos" no puede empezar en el 2.º.
"""
import importlib


def _migracion():
    return importlib.import_module("apps.storefront.migrations.0049_mas_vendidos_carrusel")


def test_quita_el_omitir_y_conserva_lo_demas():
    composicion = [
        {"id": "hero", "tipo": "hero-campana", "props": {"titulo": "x"}},
        {"id": "ps", "tipo": "producto-spotlight", "props": {"omitir": "mango", "cta_texto": "Lo quiero"}},
    ]
    nueva, cambio = _migracion()._actualizar(composicion)

    assert cambio
    assert nueva[0] == composicion[0]
    props = nueva[1]["props"]
    assert props["omitir"] == ""
    assert props["cta_texto"] == "Lo quiero"  # lo que el negocio escribió, intacto
    assert props["cantidad"] == 5
    assert composicion[1]["props"]["omitir"] == "mango"  # no muta la original


def test_la_composicion_sigue_siendo_valida(db):
    from apps.storefront import composicion

    nueva, _ = _migracion()._actualizar(
        [{"id": "ps", "tipo": "producto-spotlight", "props": {"omitir": "mango"}}]
    )
    assert len(composicion.validar(nueva)) == 1


def test_el_panel_puede_editar_cantidad_e_intervalo(db):
    from apps.storefront.models import Bloque

    esquema = Bloque.objects.get(codigo="producto-spotlight").esquema_props["properties"]
    assert esquema["cantidad"]["default"] == 5
    assert "intervalo" in esquema
