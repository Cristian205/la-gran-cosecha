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
    codigo = re.search(r"Tu código de verificación es: (\d{6})\n", correo.body).group(1)
    html = _html(correo)
    # El código es texto (copiable), no una imagen, y es el mismo en las dos versiones.
    assert f">{codigo}</p>" in html
    assert "Vence en <strong" in html and "7 minutos" in html
    assert "7 minutos" in correo.body
    assert "No compartas este código" in html and "No compartas este código" in correo.body
    assert "Ignora este mensaje" in html


def test_el_codigo_del_correo_es_el_que_se_valida(api, usuario_owner):
    paso1 = api.post(
        "/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": CLAVE}, format="json"
    ).json()
    codigo = re.search(r"Tu código de verificación es: (\d{6})", mail.outbox[-1].body).group(1)
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


def test_lleva_la_identidad_crafteech_y_nombra_el_negocio(usuario_owner, negocio):
    """La marca es Crafteech, pero dice a qué panel va el código: si no, quien
    trabaja con varios negocios no sabe dónde escribirlo."""
    from apps.content.models import StoreSettings

    config = StoreSettings.get_para(negocio)
    config.nombre_empresa = "La Gran Cosecha"
    config.color_primario = "#ff00aa"
    config.save()

    enviar_codigo_otp(usuario_owner, "654321", negocio)
    correo = mail.outbox[-1]
    html = _html(correo)
    assert "Crafteech" in correo.subject and "Crafteech" in html and "Crafteech" in correo.body
    assert "Verifica tu identidad" in html
    assert "www.crafteech.com" in html and "www.crafteech.com" in correo.body
    # El negocio se nombra en el asunto, el cuerpo y el texto plano...
    assert "para La Gran Cosecha" in correo.subject
    assert "Panel administrativo de" in html and "La Gran Cosecha" in html
    assert "Panel administrativo de La Gran Cosecha" in correo.body
    # ...pero su marca visual no: el color es el de Crafteech.
    assert "#ff00aa" not in html
    assert 'src="https://api.crafteech.com/static/correo/crafteech-logo.png"' in html


def test_sin_negocio_no_menciona_ninguno(usuario_owner):
    enviar_codigo_otp(usuario_owner, "654321")
    correo = mail.outbox[-1]
    assert "Panel administrativo de" not in _html(correo) + correo.body
    assert " para " not in correo.subject


def test_sin_url_https_del_logo_el_encabezado_lleva_solo_el_nombre(usuario_owner, settings):
    settings.CORREO_PLATAFORMA = {**settings.CORREO_PLATAFORMA, "logo_url": "/static/correo/crafteech-logo.png"}
    enviar_codigo_otp(usuario_owner, "654321")
    html = _html(mail.outbox[-1])
    assert "<img" not in html
    assert "Crafteech" in html


@pytest.mark.parametrize("color, esperado", [("#16a34a", "#083e1c"), ("#fff", "#616161")])
def test_oscurece_el_color_de_la_marca(color, esperado):
    assert _oscurecer(color) == esperado
