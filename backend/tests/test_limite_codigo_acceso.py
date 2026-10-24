"""
Límite de intentos del código de acceso (paso 2 del login).

Antes contaba los intentos fallidos pero nunca bloqueaba: con la contraseña,
el código de 6 dígitos se podía adivinar probando mientras no venciera.
"""
import re

import pytest
from django.core import mail
from django.utils import timezone

pytestmark = pytest.mark.django_db

CLAVE = "clave-de-prueba-123"


def _login(api, usuario):
    r = api.post("/api/auth/login/", {"email_usuario": usuario.email_usuario, "password": CLAVE}, format="json")
    assert r.status_code == 200, r.json()
    codigo = re.search(r"Su código OTP es: (\d{6})", mail.outbox[-1].body).group(1)
    return r.json()["otp_ticket"], codigo


def _verificar(api, ticket, codigo):
    return api.post("/api/auth/verify-otp/", {"otp_ticket": ticket, "otp_token": codigo}, format="json")


def _errado(codigo):
    return "000000" if codigo != "000000" else "111111"


def test_avisa_cuantos_intentos_quedan(api, usuario_owner, settings):
    ticket, codigo = _login(api, usuario_owner)
    r = _verificar(api, ticket, _errado(codigo))
    assert r.status_code == 400
    assert f"Le quedan {settings.OTP_MAX_INTENTOS - 1} intentos" in r.json()["message"]


def test_al_llegar_al_tope_anula_el_codigo_y_bloquea(api, usuario_owner, settings):
    ticket, codigo = _login(api, usuario_owner)
    for _ in range(settings.OTP_MAX_INTENTOS - 1):
        assert _verificar(api, ticket, _errado(codigo)).status_code == 400
    r = _verificar(api, ticket, _errado(codigo))
    assert r.status_code == 403
    assert "bloqueada" in r.json()["message"]

    usuario_owner.refresh_from_db()
    assert usuario_owner.esta_bloqueado()
    assert usuario_owner.token_verificacion is None
    # Ni el código correcto sirve ya: el bloqueo se mira antes de compararlo.
    assert _verificar(api, ticket, codigo).status_code == 403
    # Y mientras dure, tampoco se puede pedir un código nuevo.
    login = api.post("/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": CLAVE}, format="json")
    assert login.status_code == 403


def test_pasado_el_bloqueo_vuelve_a_entrar(api, usuario_owner, settings):
    ticket, codigo = _login(api, usuario_owner)
    for _ in range(settings.OTP_MAX_INTENTOS):
        _verificar(api, ticket, _errado(codigo))
    type(usuario_owner).objects.filter(pk=usuario_owner.pk).update(
        bloqueado_hasta=timezone.now() - timezone.timedelta(seconds=1)
    )
    ticket, codigo = _login(api, usuario_owner)
    assert _verificar(api, ticket, codigo).status_code == 200


def test_acertar_reinicia_la_cuenta_de_intentos(api, usuario_owner):
    ticket, codigo = _login(api, usuario_owner)
    _verificar(api, ticket, _errado(codigo))
    assert _verificar(api, ticket, codigo).status_code == 200
    usuario_owner.refresh_from_db()
    assert usuario_owner.intentos_fallidos == 0
