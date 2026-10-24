"""
Restablecer la contraseña con un código enviado por correo («¿Olvidó su contraseña?»).

Protege el flujo de punta a punta y sus garantías: no delata qué correos
existen, el código vence, se gasta al usarse y no admite intentos sin fin, el
ticket del último paso no se reutiliza, la contraseña nueva cumple las reglas
de siempre y el código de restablecer no sirve para entrar.
"""
import re

import pytest
from django.core import mail
from django.utils import timezone

pytestmark = pytest.mark.django_db

CLAVE = "clave-de-prueba-123"
NUEVA = "Cosecha-Nueva-2026!"


def _solicitar(api, email):
    r = api.post("/api/auth/password-reset/", {"email_usuario": email}, format="json")
    assert r.status_code == 200, r.json()
    return r.json()


def _codigo():
    return re.search(r"Su código de restablecimiento es: (\d{6})\n", mail.outbox[-1].body).group(1)


def _verificar(api, ticket, codigo):
    return api.post("/api/auth/password-reset/verificar/", {"reset_ticket": ticket, "codigo": codigo}, format="json")


def _nueva(api, cambio_ticket, password=NUEVA):
    return api.post(
        "/api/auth/password-reset/nueva/", {"cambio_ticket": cambio_ticket, "password_nueva": password}, format="json"
    )


def test_el_flujo_completo_cambia_la_contrasena(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario.upper())
    assert mail.outbox[-1].to == [usuario_owner.email_usuario]
    assert "Restablecer contraseña" in mail.outbox[-1].subject

    paso2 = _verificar(api, paso1["reset_ticket"], _codigo())
    assert paso2.status_code == 200, paso2.json()

    paso3 = _nueva(api, paso2.json()["cambio_ticket"])
    assert paso3.status_code == 200, paso3.json()
    usuario_owner.refresh_from_db()
    assert usuario_owner.check_password(NUEVA)
    assert not usuario_owner.check_password(CLAVE)
    # Llega el aviso de que cambió.
    assert "Su contraseña cambió" in mail.outbox[-1].subject

    # Y con la nueva se entra (el login sigue pidiendo su propio código).
    login = api.post(
        "/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": NUEVA}, format="json"
    )
    assert login.status_code == 200


def test_un_correo_que_no_existe_recibe_la_misma_respuesta(api, usuario_owner):
    existe = _solicitar(api, usuario_owner.email_usuario)
    enviados = len(mail.outbox)
    no_existe = _solicitar(api, "nadie@ejemplo.com")
    assert no_existe["message"] == existe["message"]
    assert "reset_ticket" in no_existe
    assert len(mail.outbox) == enviados  # pero no se envía nada
    assert _verificar(api, no_existe["reset_ticket"], "123456").status_code == 400


def test_una_cuenta_bloqueada_si_puede_restablecer(api, usuario_owner):
    """El bloqueo salta cuando alguien con la contraseña prueba códigos: su dueño debe poder cambiarla."""
    type(usuario_owner).objects.filter(pk=usuario_owner.pk).update(
        bloqueado_hasta=timezone.now() + timezone.timedelta(minutes=10)
    )
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    cambio = _verificar(api, paso1["reset_ticket"], _codigo()).json()["cambio_ticket"]
    assert _nueva(api, cambio).status_code == 200
    usuario_owner.refresh_from_db()
    assert not usuario_owner.esta_bloqueado()


def test_una_cuenta_inactiva_no_recibe_codigo(api, usuario_owner):
    usuario_owner.is_active = False
    usuario_owner.save()
    _solicitar(api, usuario_owner.email_usuario)
    assert len(mail.outbox) == 0


def test_el_codigo_se_gasta_al_usarse(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    codigo = _codigo()
    assert _verificar(api, paso1["reset_ticket"], codigo).status_code == 200
    assert _verificar(api, paso1["reset_ticket"], codigo).status_code == 400


def test_el_codigo_vencido_no_sirve(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    codigo = _codigo()
    type(usuario_owner).objects.filter(pk=usuario_owner.pk).update(
        reset_expira=timezone.now() - timezone.timedelta(seconds=1)
    )
    assert _verificar(api, paso1["reset_ticket"], codigo).status_code == 400


def test_cinco_intentos_fallidos_anulan_el_codigo(api, usuario_owner, settings):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    codigo = _codigo()
    errado = "000000" if codigo != "000000" else "111111"
    for _ in range(settings.RESET_MAX_INTENTOS):
        r = _verificar(api, paso1["reset_ticket"], errado)
    assert "Demasiados intentos" in r.json()["message"]
    # Ni el código bueno sirve ya.
    assert _verificar(api, paso1["reset_ticket"], codigo).status_code == 400


def test_no_reenvia_antes_de_un_minuto(api, usuario_owner):
    _solicitar(api, usuario_owner.email_usuario)
    _solicitar(api, usuario_owner.email_usuario)
    assert len(mail.outbox) == 1


def test_la_contrasena_nueva_cumple_las_reglas(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    cambio = _verificar(api, paso1["reset_ticket"], _codigo()).json()["cambio_ticket"]
    r = _nueva(api, cambio, "123")
    assert r.status_code == 400
    assert r.json()["password_nueva"]
    # Un intento rechazado no gasta el ticket: puede corregir y seguir.
    assert _nueva(api, cambio).status_code == 200


def test_el_ticket_de_cambio_no_se_reutiliza(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    cambio = _verificar(api, paso1["reset_ticket"], _codigo()).json()["cambio_ticket"]
    assert _nueva(api, cambio).status_code == 200
    assert _nueva(api, cambio, "Otra-Clave-Distinta-99").status_code == 400


def test_un_ticket_de_un_paso_no_sirve_en_otro(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    assert _nueva(api, paso1["reset_ticket"]).status_code == 400


def test_el_codigo_de_restablecer_no_sirve_para_entrar(api, usuario_owner):
    login = api.post(
        "/api/auth/login/", {"email_usuario": usuario_owner.email_usuario, "password": CLAVE}, format="json"
    ).json()
    _solicitar(api, usuario_owner.email_usuario)
    r = api.post(
        "/api/auth/verify-otp/", {"otp_ticket": login["otp_ticket"], "otp_token": _codigo()}, format="json"
    )
    assert r.status_code == 400


def test_restablecer_desbloquea_la_cuenta(api, usuario_owner):
    paso1 = _solicitar(api, usuario_owner.email_usuario)
    cambio = _verificar(api, paso1["reset_ticket"], _codigo()).json()["cambio_ticket"]
    type(usuario_owner).objects.filter(pk=usuario_owner.pk).update(intentos_fallidos=4, debe_cambiar_password=True)
    assert _nueva(api, cambio).status_code == 200
    usuario_owner.refresh_from_db()
    assert usuario_owner.intentos_fallidos == 0
    assert usuario_owner.debe_cambiar_password is False
