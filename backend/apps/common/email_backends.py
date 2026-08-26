"""Backend de correo que envia por la API HTTPS de Brevo.

Render bloquea las conexiones salientes por los puertos de SMTP (25, 465, 587)
en las instancias free, asi que el backend SMTP de Django falla ahi con
"OSError: [Errno 101] Network is unreachable" antes siquiera de autenticarse.
La API de Brevo va por el 443, que si esta permitido.

Se usa urllib de la libreria estandar a proposito: anadir `requests` solo para
un POST no compensa.
"""
import json
import logging
from email.utils import parseaddr
from urllib import error, request

from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

URL_API = "https://api.brevo.com/v3/smtp/email"


class BrevoAPIBackend(BaseEmailBackend):
    """Envia cada EmailMessage con una llamada a la API de Brevo."""

    def __init__(self, fail_silently=False, api_key=None, timeout=None, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        from django.conf import settings

        self.api_key = api_key or getattr(settings, "BREVO_API_KEY", "")
        self.timeout = timeout or getattr(settings, "EMAIL_TIMEOUT", 15)

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not self.api_key:
            if not self.fail_silently:
                raise ValueError("BREVO_API_KEY no esta configurada.")
            return 0

        enviados = 0
        for mensaje in email_messages:
            try:
                self._enviar(mensaje)
                enviados += 1
            except Exception:  # noqa: BLE001 - se respeta fail_silently
                logger.exception("Brevo rechazo el envio a %s", mensaje.to)
                if not self.fail_silently:
                    raise
        return enviados

    def _enviar(self, mensaje):
        nombre_remitente, correo_remitente = parseaddr(mensaje.from_email)

        cuerpo = {
            "sender": {"email": correo_remitente},
            "to": [{"email": destino} for destino in mensaje.to],
            "subject": mensaje.subject,
        }
        if nombre_remitente:
            cuerpo["sender"]["name"] = nombre_remitente
        if mensaje.cc:
            cuerpo["cc"] = [{"email": d} for d in mensaje.cc]
        if mensaje.bcc:
            cuerpo["bcc"] = [{"email": d} for d in mensaje.bcc]
        if mensaje.reply_to:
            nombre, correo = parseaddr(mensaje.reply_to[0])
            cuerpo["replyTo"] = {"email": correo}

        # El cuerpo de texto plano es mensaje.body; el HTML llega como
        # "alternative" cuando se usa EmailMultiAlternatives.
        cuerpo["textContent"] = mensaje.body
        for contenido, tipo in getattr(mensaje, "alternatives", []):
            if tipo == "text/html":
                cuerpo["htmlContent"] = contenido
                break

        adjuntos = self._adjuntos(mensaje)
        if adjuntos:
            cuerpo["attachment"] = adjuntos

        peticion = request.Request(
            URL_API,
            data=json.dumps(cuerpo).encode("utf-8"),
            headers={
                "api-key": self.api_key,
                "content-type": "application/json",
                "accept": "application/json",
            },
            method="POST",
        )
        try:
            with request.urlopen(peticion, timeout=self.timeout) as respuesta:
                respuesta.read()
        except error.HTTPError as exc:
            # El cuerpo del error trae el motivo real (remitente sin verificar,
            # clave invalida...). Sin leerlo solo se ve un 400 sin contexto.
            detalle = exc.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"Brevo respondio {exc.code}: {detalle}") from exc

    @staticmethod
    def _adjuntos(mensaje):
        import base64

        salida = []
        for adjunto in mensaje.attachments:
            # Django guarda los adjuntos como (nombre, contenido, mimetype) o
            # como objetos MIME ya construidos; solo se traducen los primeros.
            if not isinstance(adjunto, tuple) or len(adjunto) != 3:
                continue
            nombre, contenido, _ = adjunto
            if isinstance(contenido, str):
                contenido = contenido.encode("utf-8")
            salida.append(
                {"name": nombre, "content": base64.b64encode(contenido).decode("ascii")}
            )
        return salida
