"""
El correo del código OTP (apps/accounts/emails.py y templates/accounts/correo_otp.*).

Protege lo que importa del rediseño: que lleve el código real como texto, la
vigencia configurada y el destinatario correcto; que los datos del usuario se
escapen; y que la versión de texto siga sirviendo para leer el código.
"""
import re

import pytest
from django.core import mail

from apps.accounts.emails import _oscurecer, enviar_codigo_otp

pytestmark = pytest.mark.django_db

CLAVE = "clave-de-prueba-123"


def _html(mensaje):
    return next(contenido for contenido, tipo in mensaje.alternatives if tipo == "text/html")


def test_el_login_envia_el_codigo_real_con_su_vigencia(api, usuario_owner, settings):
    settings.OTP_EXPIRY_MINUTES = 7
    api.post("/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": CLAVE}, format="json")

    [correo] = mail.outbox
    assert correo.to == [usuario_owner.email_usuario]
    codigo = re.search(r"Su código OTP es: (\d{6})\n", correo.body).group(1)
    html = _html(correo)
    # El código es texto (copiable), no una imagen, y es el mismo en las dos versiones.
    assert f">{codigo}</td>" in html
    assert "Vence en <strong" in html and "7 minutos" in html
    assert "7 minutos" in correo.body
    assert "No comparta este código" in html and "No comparta este código" in correo.body
    assert "Ignore este mensaje" in html


def test_el_codigo_del_correo_es_el_que_se_valida(api, usuario_owner):
    paso1 = api.post(
        "/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": CLAVE}, format="json"
    ).json()
    codigo = re.search(r"Su código OTP es: (\d{6})", mail.outbox[-1].body).group(1)
    r = api.post("/api/auth/verify-otp/", {"otp_ticket": paso1["otp_ticket"], "otp_token": codigo}, format="json")
    assert r.status_code == 200, r.json()


def test_escapa_el_nombre_del_usuario(usuario_owner):
    usuario_owner.nombre_usuario = '<script>alert("x")</script> Ana'
    enviar_codigo_otp(usuario_owner, "123456")
    html = _html(mail.outbox[-1])
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    # En el texto plano no hay HTML que escapar: el nombre va tal cual.
    assert '<script>alert("x")</script> Ana' in mail.outbox[-1].body


def test_sin_logo_publico_el_encabezado_lleva_el_nombre(usuario_owner):
    enviar_codigo_otp(usuario_owner, "654321")
    html = _html(mail.outbox[-1])
    assert "<img" not in html
    assert "Panel administrativo" in html


@pytest.mark.parametrize("color, esperado", [("#16a34a", "#083e1c"), ("#fff", "#616161")])
def test_oscurece_el_color_de_la_marca(color, esperado):
    assert _oscurecer(color) == esperado
