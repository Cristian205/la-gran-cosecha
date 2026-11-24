"""
«Dispositivo de confianza hasta medianoche»: el código por correo, una vez al día.

Quien trabaja en el panel entra varias veces al día, y buscar el código en el
correo cada vez se volvió un estorbo. Tras verificar el código, el navegador
recibe un testigo firmado que vale hasta el final de ESE día (hora del país,
`TIME_ZONE`). Mientras lo presente, el login pide correo y contraseña pero no
el código: la contraseña se sigue exigiendo siempre.

El testigo deja de valer solo:

* al cambiar el día (medianoche de `TIME_ZONE`);
* si cambia la contraseña —lleva una huella del hash, así que un cambio o un
  restablecimiento anula todos los dispositivos de golpe, que es lo que se
  espera tras sospechar que alguien conoce la clave—;
* si la cuenta se desactiva (la huella también la incluye).

No se guarda nada en la base de datos: es una firma con `SECRET_KEY`, igual que
el `otp_ticket` del paso 1. Robarlo sin la contraseña no sirve para entrar.
"""
from django.conf import settings
from django.core import signing
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

#: Tope duro de vida, por si el reloj o la zona horaria jugaran en contra:
#: nunca más de un día aunque la fecha coincidiera.
_VIDA_MAXIMA = 24 * 60 * 60


def _huella(user) -> str:
    """Cambia si cambia la contraseña o se desactiva la cuenta."""
    base = f"{user.pk}:{user.password}:{user.is_active}"
    return salted_hmac(settings.OTP_DISPOSITIVO_SALT, base).hexdigest()[:24]


def emitir_testigo(user) -> str:
    """El testigo para este usuario, válido hasta el final de hoy."""
    return signing.dumps(
        {"uid": str(user.uid), "dia": timezone.localdate().isoformat(), "h": _huella(user)},
        salt=settings.OTP_DISPOSITIVO_SALT,
    )


def testigo_valido(testigo: str | None, user) -> bool:
    """¿Este testigo permite a `user` entrar hoy sin el código?"""
    if not testigo:
        return False
    try:
        datos = signing.loads(testigo, salt=settings.OTP_DISPOSITIVO_SALT, max_age=_VIDA_MAXIMA)
    except signing.BadSignature:  # incluye SignatureExpired
        return False
    return (
        datos.get("uid") == str(user.uid)
        and datos.get("dia") == timezone.localdate().isoformat()
        and constant_time_compare(datos.get("h", ""), _huella(user))
    )
