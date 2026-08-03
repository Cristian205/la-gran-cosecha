"""Envío del correo con el código OTP administrativo.

Toma el nombre de empresa, color y logo desde `apps.content.models.SiteConfig`
(mismo patrón que ya usa `apps/orders/pdf.py` para las facturas) en vez de
tener la marca fija en el código, para que cada instalación del sistema vea
su propia identidad en el correo.
"""
from email.mime.image import MIMEImage

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from apps.content.models import SiteConfig


def enviar_codigo_otp(user, otp_code):
    config = SiteConfig.get_solo()
    nombre_empresa = config.nombre_empresa or "Panel Administrativo"
    color = config.color_primario or "#16a34a"

    asunto = f"🔐 Código de Verificación - {nombre_empresa}"
    mensaje_texto = (
        f"Hola {user.nombre_usuario},\n"
        f"Su código OTP es: {otp_code}\n"
        f"Este código expirará en {settings.OTP_EXPIRY_MINUTES} minutos."
    )

    logo_bytes = None
    if config.logo and hasattr(config.logo, "path"):
        try:
            with open(config.logo.path, "rb") as archivo:
                logo_bytes = archivo.read()
        except OSError:
            logo_bytes = None

    if logo_bytes:
        marca_html = '<img src="cid:logo_otp" alt="" style="height:60px;border-radius:14px;" />'
    else:
        marca_html = (
            '<div style="width:90px;height:90px;margin:auto;border-radius:50%;'
            'background:rgba(255,255,255,.12);line-height:90px;font-size:42px;color:white;">🔒</div>'
        )

    html = f"""
    <div style="margin:0;padding:50px 20px;background:#edf2f7;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:650px;margin:auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.12);">
        <div style="height:8px;background:linear-gradient(90deg,{color},#0f172a);"></div>
        <div style="background:linear-gradient(135deg,#0f172a,{color});text-align:center;padding:50px 30px;">
          {marca_html}
          <h1 style="color:white;margin:25px 0 10px;font-size:32px;font-weight:700;letter-spacing:1px;">{nombre_empresa}</h1>
          <p style="color:rgba(255,255,255,.85);font-size:15px;margin:0;">Plataforma Administrativa Segura</p>
        </div>
        <div style="padding:50px 45px;">
          <div style="display:inline-block;background:#e8fff1;color:{color};padding:8px 18px;border-radius:50px;font-size:13px;font-weight:600;margin-bottom:25px;">VERIFICACIÓN DE IDENTIDAD</div>
          <h2 style="margin-top:0;color:#0f172a;font-size:28px;">Hola {user.nombre_usuario}</h2>
          <p style="font-size:16px;color:#4b5563;line-height:1.8;">
            Detectamos una solicitud de acceso a su cuenta. Para proteger la información
            de la organización, confirme su identidad utilizando el siguiente código de verificación:
          </p>
          <div style="margin:40px 0;text-align:center;">
            <div style="display:inline-block;padding:28px 45px;background:{color};border-radius:20px;box-shadow:0 12px 35px rgba(0,0,0,.2);">
              <div style="color:white;font-size:14px;letter-spacing:2px;margin-bottom:10px;">CÓDIGO OTP</div>
              <div style="color:white;font-size:44px;font-weight:800;letter-spacing:12px;">{otp_code}</div>
            </div>
          </div>
          <div style="background:#fff8e1;border-left:5px solid #ffc107;padding:18px;border-radius:12px;margin-bottom:25px;">
            <strong style="color:#856404;">Importante:</strong>
            <div style="margin-top:6px;color:#856404;line-height:1.6;">
              Este código expirará en <strong>{settings.OTP_EXPIRY_MINUTES} minutos</strong>.
            </div>
          </div>
          <p style="font-size:15px;color:#6b7280;line-height:1.8;">
            Si usted no realizó esta solicitud, puede ignorar este mensaje de forma segura.
          </p>
        </div>
        <div style="background:#0f172a;text-align:center;padding:35px 20px;">
          <div style="color:white;font-size:16px;font-weight:600;margin-bottom:10px;">{nombre_empresa}</div>
          <div style="color:#94a3b8;font-size:13px;line-height:1.8;">Este correo fue generado automáticamente por el sistema de autenticación segura.</div>
          <div style="margin-top:15px;color:#64748b;font-size:12px;">© {timezone.now().year} {nombre_empresa}. Todos los derechos reservados.</div>
        </div>
      </div>
    </div>
    """

    email = EmailMultiAlternatives(
        subject=asunto,
        body=mensaje_texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email_usuario],
    )
    email.attach_alternative(html, "text/html")

    if logo_bytes:
        imagen = MIMEImage(logo_bytes)
        imagen.add_header("Content-ID", "<logo_otp>")
        imagen.add_header("Content-Disposition", "inline", filename="logo.png")
        email.attach(imagen)

    email.send(fail_silently=False)
