"""
El formulario comercial del sitio de Crafteech (`contact.SolicitudComercial`).

Es un endpoint público y sin tienda: lo llama alguien que todavía no es
cliente. Protege cinco cosas: que una solicitud válida se guarda con lo que la
persona escribió, que sin forma de responderle se rechaza, que un bot que
llena la trampa recibe un "ok" pero no deja nada, que una solución inventada
no pasa, y que un mismo origen no puede inundar la bandeja.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.contact.models import SolicitudComercial

URL = "/api/contact/solicitudes-comerciales/"

VALIDA = {
    "nombre": "Laura Gómez",
    "negocio": "Frutería La 80",
    "solucion": "COMMERCE",
    "descripcion": "Quiero vender por internet mis frutas al por mayor.",
    "contacto": "laura@example.com",
    "origen": "caminos-commerce",
    "pagina": "https://www.crafteech.com/#caminos",
}


@pytest.fixture(autouse=True)
def _sin_limite_previo():
    """El tope por IP vive en la caché: cada prueba empieza de cero."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def cliente():
    return APIClient()


def test_una_solicitud_valida_se_guarda_tal_como_se_escribio(db, cliente):
    r = cliente.post(URL, VALIDA, format="json")

    assert r.status_code == 201
    assert r.json() == {"ok": True}
    s = SolicitudComercial.objects.get()
    assert (s.nombre, s.negocio, s.solucion) == ("Laura Gómez", "Frutería La 80", "COMMERCE")
    assert s.contacto == "laura@example.com"
    assert s.origen == "caminos-commerce"
    assert s.estado == "NUEVA"


@pytest.mark.parametrize("contacto", ["3001234567", "+57 300 123 4567", "(601) 234-5678"])
def test_un_telefono_tambien_sirve_para_responder(db, cliente, contacto):
    r = cliente.post(URL, {**VALIDA, "contacto": contacto}, format="json")
    assert r.status_code == 201


@pytest.mark.parametrize("contacto", ["", "hola", "123", "no es un correo@", "abc def ghi"])
def test_sin_correo_ni_telefono_valido_no_hay_a_quien_responderle(db, cliente, contacto):
    r = cliente.post(URL, {**VALIDA, "contacto": contacto}, format="json")

    assert r.status_code == 400
    assert "contacto" in r.json()
    assert SolicitudComercial.objects.count() == 0


def test_solo_nombre_y_contacto_son_obligatorios(db, cliente):
    r = cliente.post(URL, {"nombre": "Ana", "contacto": "ana@example.com"}, format="json")

    assert r.status_code == 201
    s = SolicitudComercial.objects.get()
    assert s.solucion == "POR_DEFINIR"
    assert s.negocio == ""


def test_una_solucion_que_no_existe_no_pasa(db, cliente):
    r = cliente.post(URL, {**VALIDA, "solucion": "GRATIS"}, format="json")

    assert r.status_code == 400
    assert "solucion" in r.json()


def test_el_bot_que_llena_la_trampa_recibe_ok_pero_no_deja_nada(db, cliente):
    r = cliente.post(URL, {**VALIDA, "sitio_web": "http://spam.example"}, format="json")

    assert r.status_code == 201
    assert r.json() == {"ok": True}
    assert SolicitudComercial.objects.count() == 0


def test_no_se_puede_leer_nada_por_este_endpoint(db, cliente):
    """Solo crea: leer las solicitudes es del equipo, desde el admin."""
    r = cliente.get(URL)

    assert r.status_code == 405


def test_un_mismo_origen_no_puede_inundar_la_bandeja(db, cliente, settings):
    settings.TASA_SOLICITUD_COMERCIAL = "3/hour"

    codigos = [cliente.post(URL, VALIDA, format="json").status_code for _ in range(5)]

    assert codigos == [201, 201, 201, 429, 429]
    assert SolicitudComercial.objects.count() == 3
