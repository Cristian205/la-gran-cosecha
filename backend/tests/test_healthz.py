"""
El healthcheck de la plataforma (`/healthz`) y el de diagnóstico (`/healthz/db`).

`/healthz` decide si Railway da por bueno un despliegue, así que tiene que
contestar 200 aunque el host no esté en ALLOWED_HOSTS (Railway sondea con
`Host: healthcheck.railway.app`) y sin una sola consulta a Supabase.
"""
from unittest import mock

import pytest
from django.db import OperationalError
from django.test import override_settings

HOST_SONDA_RAILWAY = "healthcheck.railway.app"


@override_settings(ALLOWED_HOSTS=["api.crafteech.com"])
@pytest.mark.parametrize("ruta", ["/healthz", "/healthz/"])
def test_healthz_responde_200_con_el_host_de_la_sonda_y_sin_bd(client, ruta):
    # Sin la marca django_db, pytest-django hace fallar cualquier acceso a la
    # base: que pase es la prueba de que /healthz no consulta nada.
    respuesta = client.get(ruta, HTTP_HOST=HOST_SONDA_RAILWAY)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "ok"}


@override_settings(SECURE_SSL_REDIRECT=True)
def test_healthz_no_redirige_a_https(client):
    respuesta = client.get("/healthz", secure=False)
    assert respuesta.status_code == 200


def test_healthz_no_depende_de_la_base_de_datos(client):
    with mock.patch(
        "apps.tenancy.middleware.declarar_tenant_en_la_base",
        side_effect=OperationalError("sin conexión"),
    ):
        respuesta = client.get("/healthz")
    assert respuesta.status_code == 200


@override_settings(ALLOWED_HOSTS=["api.crafteech.com"])
def test_las_demas_rutas_siguen_validando_el_host(client):
    respuesta = client.get("/healthz/db", HTTP_HOST=HOST_SONDA_RAILWAY)
    assert respuesta.status_code == 400


@pytest.mark.django_db
def test_healthz_db_comprueba_la_base(client):
    respuesta = client.get("/healthz/db")
    assert respuesta.status_code == 200
    assert respuesta.json()["database"] == "ok"


@pytest.mark.django_db
def test_healthz_db_no_filtra_el_mensaje_del_driver(client):
    error = OperationalError('connection to server at "db.secreto.supabase.co" failed')
    conexion_caida = mock.Mock()
    conexion_caida.cursor.side_effect = error
    with mock.patch("config.health.connection", conexion_caida):
        respuesta = client.get("/healthz/db")

    assert respuesta.status_code == 503
    assert respuesta.json()["database"] == "OperationalError"
    assert b"supabase" not in respuesta.content
