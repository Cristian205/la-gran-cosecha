"""
`0054_banner_por_dispositivo`: los banners ganan foto y encuadre de tablet, y el
hero sus ajustes de diseño y legibilidad, sin tocar lo ya guardado.
"""
import pytest

from apps.storefront import composicion
from apps.storefront.models import Bloque

pytestmark = pytest.mark.django_db


def _props(codigo):
    return Bloque.objects.get(codigo=codigo).esquema_props["properties"]


def test_hero_y_campana_destacada_tienen_tablet():
    for codigo in ("hero-campana", "campana-destacada"):
        props = _props(codigo)
        assert props["imagen_tablet"]["formato"] == "imagen"
        assert "enfoque_tablet" in props
        # La de tablet va justo después de la de móvil: el orden es el del formulario.
        claves = list(props)
        assert claves.index("imagen_tablet") == claves.index("imagen_movil") + 1


def test_hero_tiene_ajustes_con_defaults_del_aspecto_actual():
    props = _props("hero-campana")
    assert props["altura"]["default"] == "completa"
    assert props["alineacion"]["default"] == "izquierda"
    assert props["posicion"]["default"] == "arriba"
    assert props["degradado"]["default"] == "editorial"
    assert props["tono_texto"]["default"] == "claro"
    assert props["oscurecer"]["default"] == 0
    assert props["cta_estilo"]["default"] == "ambar"
    assert props["cta2_estilo"]["default"] == "fantasma"
    assert props["alineacion"]["opciones_etiquetas"]["centro"] == "Centro"


def test_una_composicion_vieja_y_una_nueva_siguen_validando():
    vieja = [{"id": "h", "tipo": "hero-campana", "props": {"titulo": "Hola", "imagen": "/a.jpg"}}]
    nueva = [
        {
            "id": "h",
            "tipo": "hero-campana",
            "props": {
                "titulo": "Hola",
                "imagen": "/a.jpg",
                "imagen_tablet": "/t.jpg",
                "imagen_movil": "/m.jpg",
                "enfoque_tablet": "20% 50%",
                "oscurecer": 30,
                "cta_visible": False,
            },
        }
    ]
    assert composicion.validar(vieja)[0]["props"] == vieja[0]["props"]
    assert composicion.validar(nueva)[0]["props"]["imagen_tablet"] == "/t.jpg"
