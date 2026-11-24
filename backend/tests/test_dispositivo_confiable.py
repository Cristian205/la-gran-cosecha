"""
El código por correo, una vez al día por dispositivo (accounts/dispositivo.py).

  * Verificar el código pidiendo «confiar en este dispositivo» devuelve un
    testigo; con él, el login del mismo día entra con la contraseña sin código.
  * La contraseña se sigue exigiendo siempre.
  * El testigo caduca al cambiar el día, si cambia la contraseña, si se
    desactiva la cuenta, y no sirve para otra persona.
  * Sin pedirlo, no se emite testigo: el flujo de siempre no cambia.
"""
import datetime
import re

import pytest
from django.core import mail
from django.utils import timezone

from apps.accounts.dispositivo import testigo_valido as es_valido

pytestmark = pytest.mark.django_db

CLAVE = "clave-de-prueba-123"


def _login(api, user, clave=CLAVE, dispositivo=None):
    cuerpo = {"email_usuario": user.email_usuario, "password": clave}
    if dispositivo is not None:
        cuerpo["dispositivo"] = dispositivo
    return api.post("/api/auth/login/", cuerpo, format="json")


def _verificar(api, ticket, confiar):
    codigo = re.search(r"Tu código de verificación es: (\d{6})", mail.outbox[-1].body).group(1)
    return api.post(
        "/api/auth/verify-otp/",
        {"otp_ticket": ticket, "otp_token": codigo, "confiar_dispositivo": confiar},
        format="json",
    )


def _testigo(api, user):
    paso1 = _login(api, user).json()
    r = _verificar(api, paso1["otp_ticket"], confiar=True)
    assert r.status_code == 200, r.json()
    return r.json()["dispositivo"]


def test_sin_pedirlo_no_hay_testigo(api, usuario_owner):
    paso1 = _login(api, usuario_owner).json()
    r = _verificar(api, paso1["otp_ticket"], confiar=False)
    assert r.status_code == 200
    assert "dispositivo" not in r.json()


def test_con_el_testigo_de_hoy_entra_sin_codigo(api, usuario_owner):
    testigo = _testigo(api, usuario_owner)
    enviados = len(mail.outbox)

    r = _login(api, usuario_owner, dispositivo=testigo)

    assert r.status_code == 200, r.json()
    datos = r.json()
    assert datos["sin_codigo"] is True
    assert datos["access"] and datos["refresh"]
    assert "otp_ticket" not in datos
    assert len(mail.outbox) == enviados, "no debe mandar otro código"


def test_la_contrasena_se_sigue_exigiendo(api, usuario_owner):
    testigo = _testigo(api, usuario_owner)
    r = _login(api, usuario_owner, clave="otra-clave", dispositivo=testigo)
    assert r.status_code == 400
    assert "access" not in r.json()


def test_al_dia_siguiente_vuelve_a_pedir_el_codigo(api, usuario_owner, monkeypatch):
    testigo = _testigo(api, usuario_owner)
    manana = timezone.localdate() + datetime.timedelta(days=1)
    monkeypatch.setattr("apps.accounts.dispositivo.timezone.localdate", lambda: manana)

    r = _login(api, usuario_owner, dispositivo=testigo)

    assert r.status_code == 200
    assert "otp_ticket" in r.json() and "access" not in r.json()


def test_cambiar_la_contrasena_anula_el_testigo(api, usuario_owner):
    testigo = _testigo(api, usuario_owner)
    usuario_owner.set_password("clave-nueva-456")
    usuario_owner.save()

    r = _login(api, usuario_owner, clave="clave-nueva-456", dispositivo=testigo)

    assert "otp_ticket" in r.json() and "access" not in r.json()


def test_el_testigo_no_sirve_para_otra_persona(usuario_owner, django_user_model, negocio):
    from apps.accounts.dispositivo import emitir_testigo

    otra = django_user_model.objects.create_user(
        email_usuario="otra@example.com", password=CLAVE, nombre_usuario="Otra"
    )
    assert es_valido(emitir_testigo(usuario_owner), usuario_owner)
    assert not es_valido(emitir_testigo(usuario_owner), otra)


def test_un_testigo_alterado_no_vale(api, usuario_owner):
    testigo = _testigo(api, usuario_owner)
    assert not es_valido(testigo[:-2] + "xx", usuario_owner)
    assert not es_valido("", usuario_owner)
    assert not es_valido(None, usuario_owner)


def test_una_cuenta_desactivada_no_entra_con_testigo(api, usuario_owner):
    testigo = _testigo(api, usuario_owner)
    usuario_owner.is_active = False
    usuario_owner.save()

    r = _login(api, usuario_owner, dispositivo=testigo)

    assert "access" not in r.json()
