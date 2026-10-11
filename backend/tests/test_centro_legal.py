"""
El centro legal administrable (content/0027, `/api/content/legal/`).

Lo que protege:

1. Que la tienda lo lee sin sesión y solo el staff lo escribe.
2. Que cada negocio tiene el suyo.
3. Que el historial de cada política lo lleva el servidor: se anota cuando
   cambia el contenido o los datos que la alimentan, y el panel no lo puede
   reescribir. Es lo que deja demostrar qué versión estaba vigente un día.
"""
from datetime import date

import pytest

from apps.content.legal import ContenidoLegalInvalido, combinar
from apps.content.models import StoreSettings

pytestmark = pytest.mark.django_db

URL = "/api/content/legal/"


def test_lectura_publica_y_escritura_solo_staff(api, api_owner, negocio):
    assert api.get(URL).status_code == 200
    assert api.get(URL).json() == {}

    r = api.patch(URL, {"empresa": {"nit": "900.000.000-1"}}, format="json")
    assert r.status_code in (401, 403)

    r = api_owner.patch(URL, {"empresa": {"nit": "900.000.000-1"}}, format="json")
    assert r.status_code == 200, r.data
    assert api.get(URL).json()["empresa"]["nit"] == "900.000.000-1"


def test_rechaza_claves_desconocidas(api_owner, negocio):
    r = api_owner.patch(URL, {"cualquier_cosa": {}}, format="json")
    assert r.status_code == 400


def test_cada_negocio_tiene_el_suyo(api_owner, negocio):
    from apps.tenancy.models import Tenant

    otro = Tenant.objects.create(slug="otro", nombre="Otro", estado="ACTIVO")
    api_owner.patch(URL, {"empresa": {"razon_social": "Mío S.A.S."}}, format="json")

    assert StoreSettings.get_para(otro).legal == {}


def test_cambiar_una_politica_anota_el_historial(api_owner, negocio):
    api_owner.patch(
        URL,
        {"politicas": {"politica-de-cookies": {"resumen": "v1", "nota_cambio": "Primera versión"}}},
        format="json",
    )
    datos = api_owner.patch(
        URL, {"politicas": {"politica-de-cookies": {"resumen": "v2"}}}, format="json"
    ).json()

    politica = datos["politicas"]["politica-de-cookies"]
    assert politica["resumen"] == "v2"
    assert politica["actualizado"] == date.today().isoformat()
    assert [h["cambio"] for h in politica["historial"]] == [
        "Primera versión",
        "Actualización del contenido",
    ]
    assert "nota_cambio" not in politica


def test_sin_cambios_no_se_anota_nada():
    anterior = combinar({}, {"politicas": {"medios-de-pago": {"resumen": "x"}}}, hoy=date(2026, 1, 1))
    igual = combinar(anterior, {"politicas": {"medios-de-pago": {"resumen": "x"}}}, hoy=date(2026, 2, 1))

    assert igual["politicas"]["medios-de-pago"]["historial"] == anterior["politicas"]["medios-de-pago"]["historial"]
    assert igual["politicas"]["medios-de-pago"]["actualizado"] == "2026-01-01"


def test_cambiar_los_datos_de_envio_actualiza_su_politica():
    resultado = combinar({}, {"envios": {"costos": "Según zona"}}, hoy=date(2026, 3, 5))

    envios = resultado["politicas"]["politica-de-envios"]
    assert envios["actualizado"] == "2026-03-05"
    assert envios["historial"] == [{"fecha": "2026-03-05", "cambio": "Actualización de las condiciones"}]
    # Los datos de identidad no generan versiones.
    assert "terminos-y-condiciones" not in resultado["politicas"]


def test_el_panel_no_reescribe_el_historial():
    anterior = combinar({}, {"politicas": {"politica-de-retracto": {"resumen": "a"}}}, hoy=date(2026, 1, 1))
    falso = [{"fecha": "2020-01-01", "cambio": "inventado"}]
    nuevo = combinar(anterior, {"politicas": {"politica-de-retracto": {"resumen": "a", "historial": falso}}})

    assert nuevo["politicas"]["politica-de-retracto"]["historial"] == anterior["politicas"]["politica-de-retracto"]["historial"]


def test_respeta_una_fecha_elegida_a_proposito():
    resultado = combinar(
        {}, {"politicas": {"terminos-y-condiciones": {"resumen": "x", "actualizado": "2026-06-01"}}},
        hoy=date(2026, 5, 20),
    )
    assert resultado["politicas"]["terminos-y-condiciones"]["actualizado"] == "2026-06-01"


def test_fecha_con_formato_invalido():
    with pytest.raises(ContenidoLegalInvalido):
        combinar({}, {"politicas": {"medios-de-pago": {"actualizado": "01/02/2026"}}})
