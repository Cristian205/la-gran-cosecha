"""Envío del correo con el código OTP administrativo.

Toma el nombre de empresa, color y logo desde `apps.content.models.StoreSettings`
(mismo patrón que ya usa `apps/orders/pdf.py` para las facturas) en vez de
tener la marca fija en el código, para que cada instalación del sistema vea
su propia identidad en el correo.
"""
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from apps.content.models import StoreSettings

COLOR_POR_DEFECTO = "#16a34a"


def _es_hex(valor: str) -> bool:
    """Solo un hexadecimal llega al HTML: el color se escribe en atributos."""
    v = (valor or "").strip()
    return v.startswith("#") and len(v) in (4, 7) and all(c in "0123456789abcdefABCDEF" for c in v[1:])


def _oscurecer(color: str, cuanto: float = 0.62) -> str:
    """
    El color de la marca, oscurecido para el encabezado (verde oscuro con el
    verde de La Gran Cosecha): el blanco del nombre contrasta sea cual sea el
    color del negocio. Recibe un hexadecimal ya validado con `_es_hex`.
    """
    valor = color.strip().lstrip("#")
    if len(valor) == 3:
        valor = "".join(c * 2 for c in valor)
    r, g, b = (int(valor[i : i + 2], 16) for i in (0, 2, 4))
    return "#{:02x}{:02x}{:02x}".format(*(round(c * (1 - cuanto)) for c in (r, g, b)))


def _contexto_de_marca(user, tenant):
    """Nombre, colores y logo del negocio, y el nombre de la persona."""
    # El correo lleva la marca del negocio desde el que se inicia sesión. Sin
    # tenant (login antes de que la fase 4 lo resuelva) cae al puente de
    # get_para, que acierta mientras solo haya un negocio dado de alta.
    config = StoreSettings.get_para(tenant)
    if config is None:
        config = StoreSettings()  # valores por defecto del modelo
    nombre_empresa = config.nombre_empresa or "Panel Administrativo"
    color = config.color_primario or COLOR_POR_DEFECTO
    if not _es_hex(color):
        color = COLOR_POR_DEFECTO

    # El logo se referencia por su URL publica en vez de incrustarlo como
    # adjunto con cid:. Motivos: la API de Brevo (ver
    # apps.common.email_backends) no admite imagenes en linea, y una URL
    # publica pesa menos y la muestran todos los clientes de correo.
    #
    # Solo sirve si la URL es absoluta, que es lo que devuelve el storage de
    # Cloudflare R2. Con almacenamiento local es relativa ("/media/...") y no
    # se puede resolver desde el correo: entonces el encabezado lleva solo el
    # nombre, que se lee igual con las imágenes desactivadas.
    logo_url = ""
    if config.logo:
        try:
            url = config.logo.url
            if url.startswith("http"):
                logo_url = url
        except Exception:  # noqa: BLE001 - cada storage falla distinto
            logo_url = ""

    return {
        "nombre_empresa": nombre_empresa,
        "nombre_usuario": user.nombre_usuario,
        "color": color,
        "color_oscuro": _oscurecer(color),
        "logo_url": logo_url,
        "anio": timezone.now().year,
    }


def _enviar(user, asunto: str, plantilla: str, contexto: dict) -> None:
    """
    Envía `templates/accounts/<plantilla>.html` y su versión `.txt`. Las
    plantillas escapan los datos: un nombre con «<» no inyecta HTML.
    """
    mensaje_texto = render_to_string(f"accounts/{plantilla}.txt", contexto).strip() + "\n"
    html = render_to_string(f"accounts/{plantilla}.html", contexto)
    email = EmailMultiAlternatives(
        subject=asunto,
        body=mensaje_texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email_usuario],
    )
    email.attach_alternative(html, "text/html")
    email.send(fail_silently=False)


def enviar_codigo_otp(user, otp_code, tenant=None):
    contexto = _contexto_de_marca(user, tenant)
    contexto.update(otp_code=otp_code, minutos=settings.OTP_EXPIRY_MINUTES)
    _enviar(user, f"🔐 Código de Verificación - {contexto['nombre_empresa']}", "correo_otp", contexto)


def enviar_codigo_restablecer(user, codigo, tenant=None):
    """El código para restablecer la contraseña («¿Olvidó su contraseña?»)."""
    contexto = _contexto_de_marca(user, tenant)
    contexto.update(otp_code=codigo, minutos=settings.OTP_EXPIRY_MINUTES)
    _enviar(user, f"🔑 Restablecer contraseña - {contexto['nombre_empresa']}", "correo_restablecer", contexto)


def enviar_aviso_password_cambiada(user, tenant=None):
    """Aviso de que la contraseña cambió: si no fue la persona, se entera."""
    contexto = _contexto_de_marca(user, tenant)
    ahora = timezone.localtime()
    contexto["cuando"] = f"{ahora:%Y-%m-%d} a las {ahora:%H:%M}"
    _enviar(user, f"Su contraseña cambió - {contexto['nombre_empresa']}", "correo_password_cambiada", contexto)
