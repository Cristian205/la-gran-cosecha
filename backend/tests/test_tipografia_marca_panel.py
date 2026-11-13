"""
El nombre del negocio en el panel, con la letra de su tienda.

`tipografia_de_marca` decide con qué fuente escribe el sidebar el nombre:
primero la cabecera PUBLICADA (la variante «comercio» fija Fraunces itálica),
después la tipografía de títulos elegida en Apariencia y, si no hay ninguna,
la del texto («heredada»).
"""
import pytest

from apps.content.aspecto_panel import tipografia_de_marca
from apps.content.models import StoreSettings
from apps.storefront.models import Pagina, VersionPagina

pytestmark = pytest.mark.django_db


def _publicar_cabecera(negocio, variante, estado=VersionPagina.Estado.PUBLICADA):
    pagina, _ = Pagina.all_tenants.get_or_create(
        tenant=negocio, ruta="/_layout", defaults={"titulo": "Armazón", "tipo": Pagina.Tipo.LAYOUT}
    )
    VersionPagina.all_tenants.filter(pagina=pagina, estado=estado).delete()
    ultimo = VersionPagina.all_tenants.filter(pagina=pagina).order_by("-numero").first()
    VersionPagina.all_tenants.create(
        tenant=negocio,
        pagina=pagina,
        estado=estado,
        numero=(ultimo.numero + 1) if ultimo else 1,
        composicion=[{"id": "cabecera-0", "tipo": "cabecera", "variante": variante, "props": {}}],
    )


def _config(negocio, **tokens):
    config = StoreSettings.get_para(negocio)
    config.tokens = {**(config.tokens or {}), **tokens}
    config.save(update_fields=["tokens"])
    return config


def test_la_cabecera_comercio_fija_fraunces_italica(negocio):
    _publicar_cabecera(negocio, "comercio")
    assert tipografia_de_marca(_config(negocio, **{"fuente-titulos": "playfair"})) == {
        "fuente": "fraunces",
        "italica": True,
    }


def test_sin_cabecera_con_letra_propia_manda_la_de_titulos(negocio):
    _publicar_cabecera(negocio, "clasica")
    assert tipografia_de_marca(_config(negocio, **{"fuente-titulos": "playfair"})) == {
        "fuente": "playfair",
        "italica": False,
    }


def test_un_borrador_no_cuenta_solo_lo_publicado(negocio):
    _publicar_cabecera(negocio, "clasica")
    _publicar_cabecera(negocio, "comercio", estado=VersionPagina.Estado.BORRADOR)
    assert tipografia_de_marca(_config(negocio))["italica"] is False


def test_sin_eleccion_hereda_la_fuente_del_texto(negocio):
    _publicar_cabecera(negocio, "clasica")
    assert tipografia_de_marca(_config(negocio, **{"fuente-titulos": "heredada"})) == {
        "fuente": "heredada",
        "italica": False,
    }
