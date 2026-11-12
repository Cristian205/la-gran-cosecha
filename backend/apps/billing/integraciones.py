"""
Integraciones de la plataforma: qué está conectado y si funciona.

Las credenciales de la base de datos, del almacenamiento (R2), del correo
(Brevo) y de WhatsApp viven en variables de entorno del servidor, no en la base
de datos, y este módulo NO cambia eso: no guarda ni devuelve ningún secreto.
Lo que sí hace es decirle al panel, sin exponer valores:

- qué variables están definidas y cuáles faltan (solo un booleano por variable),
- si la conexión funciona AHORA (base de datos, almacenamiento y correo se
  prueban de verdad; una llamada por prueba, a petición de quien las pide).

WhatsApp se configura por empresa y no tiene una conexión única que probar:
aquí solo se cuentan las empresas que lo usan y se muestran las variables de la
plataforma que sus proveedores necesitan.

Solo staff de plataforma (`EsStaffDePlataforma`), igual que el resto de
`/platform/`.
"""
import json
import logging
import time
from urllib import error, request

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.context import ambito_de_plataforma

from .permisos import EsStaffDePlataforma

logger = logging.getLogger(__name__)

API_CUENTA_BREVO = "https://api.brevo.com/v3/account"


def _definida(nombre: str) -> bool:
    if nombre == "DATABASE_URL":
        # No es un atributo de `settings`: se lee de la conexión ya configurada.
        return bool(settings.DATABASES["default"].get("NAME"))
    return bool(str(getattr(settings, nombre, "") or "").strip())


def _guardadas() -> set[str]:
    """Las claves que tienen un valor guardado desde el panel."""
    from .models import ConfiguracionIntegracion  # noqa: PLC0415

    try:
        return set(ConfiguracionIntegracion.objects.values_list("clave", flat=True))
    except Exception:  # noqa: BLE001 - tabla sin migrar: nada guardado
        return set()


# Qué se puede escribir desde el panel, por integración. DATABASE_URL queda
# fuera a propósito: la base de datos es de donde se leería todo lo demás.
#   nombre -> (secreta, validador)
def _sin_validar(valor: str) -> str | None:
    return None


def _validar_remitente(valor: str) -> str | None:
    return None if "@" in valor else "Escribe un remitente, por ejemplo: Soporte <hola@tudominio.com>."


EDITABLES = {
    "almacenamiento": {
        "R2_ACCOUNT_ID": (False, _sin_validar),
        "R2_ACCESS_KEY_ID": (True, _sin_validar),
        "R2_SECRET_ACCESS_KEY": (True, _sin_validar),
        "R2_BUCKET_NAME": (False, _sin_validar),
        "R2_PUBLIC_URL": (False, lambda v: None if v.startswith(("http://", "https://")) else "Debe empezar por https://"),
    },
    "correo": {
        "BREVO_API_KEY": (True, _sin_validar),
        "DEFAULT_FROM_EMAIL": (False, _validar_remitente),
    },
    "whatsapp": {
        "META_WHATSAPP_TOKEN": (True, _sin_validar),
        "META_APP_SECRET": (True, _sin_validar),
        "META_WEBHOOK_VERIFY_TOKEN": (True, _sin_validar),
        "TWILIO_ACCOUNT_SID": (False, _sin_validar),
        "TWILIO_AUTH_TOKEN": (True, _sin_validar),
    },
}


def _variables(*especificaciones):
    """
    [(nombre, requerida, nota)] → lista serializable. Nunca lleva un secreto:
    solo si está definida y de dónde viene. Los valores que no son secretos
    (el nombre del bucket, el remitente) sí se devuelven, para precargar el formulario.
    """
    guardadas = _guardadas()
    resultado = []
    for nombre, requerida, nota in especificaciones:
        config = next((v[nombre] for v in EDITABLES.values() if nombre in v), None)
        definida = _definida(nombre)
        item = {
            "nombre": nombre,
            "definida": definida,
            "requerida": requerida,
            "nota": nota,
            "editable": config is not None,
            "secreta": bool(config and config[0]),
            "origen": "panel" if nombre in guardadas else ("servidor" if definida else None),
        }
        if config is not None and not config[0] and definida:
            item["valor"] = str(getattr(settings, nombre))
        resultado.append(item)
    return resultado


def _modo_de_correo() -> str:
    backend = getattr(settings, "EMAIL_BACKEND", "")
    if "BrevoAPIBackend" in backend:
        return "brevo"
    if backend.endswith("smtp.EmailBackend"):
        return "smtp"
    if backend.endswith("console.EmailBackend"):
        return "consola"
    return "otro"


# ------------------------------------------------------------------ pruebas


def _probar_base_de_datos():
    inicio = time.perf_counter()
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    except Exception as exc:  # noqa: BLE001 - cualquier fallo es "no conecta"
        # El mensaje del driver lleva host y usuario: al log, no a la respuesta.
        logger.error("integraciones/base_datos: %s", exc)
        return {"ok": False, "mensaje": f"La base de datos no responde ({type(exc).__name__})."}
    ms = round((time.perf_counter() - inicio) * 1000)
    return {"ok": True, "mensaje": "La base de datos respondió.", "ms": ms}


def _probar_almacenamiento():
    if not getattr(settings, "USE_R2", False):
        return {
            "ok": False,
            "mensaje": "Está en disco local: los archivos se pierden en cada despliegue. Define las variables de R2.",
        }
    inicio = time.perf_counter()
    nombre = "plataforma/_prueba_de_conexion.txt"
    try:
        guardado = default_storage.save(nombre, ContentFile(b"ok"))
        leido = default_storage.exists(guardado)
        default_storage.delete(guardado)
    except Exception as exc:  # noqa: BLE001
        logger.error("integraciones/almacenamiento: %s", exc)
        return {"ok": False, "mensaje": f"R2 no aceptó la prueba ({type(exc).__name__}). Revisa las credenciales."}
    if not leido:
        return {"ok": False, "mensaje": "R2 guardó el archivo pero no lo encontró después."}
    ms = round((time.perf_counter() - inicio) * 1000)
    return {"ok": True, "mensaje": "R2 guardó, encontró y borró un archivo de prueba.", "ms": ms}


def _probar_correo():
    modo = _modo_de_correo()
    if modo != "brevo":
        return {
            "ok": False,
            "mensaje": {
                "consola": "El correo sale por consola: nada se envía de verdad. Usa el backend de Brevo en producción.",
                "smtp": "Está en SMTP: esta prueba solo comprueba Brevo. Verifica que el servidor permita el puerto SMTP.",
            }.get(modo, "El backend de correo no es Brevo y no se puede probar desde aquí."),
        }
    clave = getattr(settings, "BREVO_API_KEY", "")
    if not clave:
        return {"ok": False, "mensaje": "Falta BREVO_API_KEY."}
    # Consulta los datos de la cuenta: comprueba la clave sin enviar ningún correo.
    inicio = time.perf_counter()
    peticion = request.Request(API_CUENTA_BREVO, headers={"api-key": clave, "accept": "application/json"})
    try:
        with request.urlopen(peticion, timeout=8) as respuesta:  # noqa: S310 - URL fija de Brevo
            json.loads(respuesta.read() or b"{}")
    except error.HTTPError as exc:
        if exc.code in (401, 403):
            return {"ok": False, "mensaje": "Brevo rechazó la clave (BREVO_API_KEY inválida o sin permisos)."}
        return {"ok": False, "mensaje": f"Brevo respondió con un error {exc.code}."}
    except Exception as exc:  # noqa: BLE001 - red caída, timeout…
        logger.error("integraciones/correo: %s", exc)
        return {"ok": False, "mensaje": "No se pudo contactar a Brevo desde el servidor."}
    ms = round((time.perf_counter() - inicio) * 1000)
    return {"ok": True, "mensaje": "Brevo aceptó la clave (no se envió ningún correo).", "ms": ms}


PRUEBAS = {
    "base_datos": _probar_base_de_datos,
    "almacenamiento": _probar_almacenamiento,
    "correo": _probar_correo,
}


# ------------------------------------------------------------------ estado


def _estado_de(variables, *, cumple: bool | None = None):
    faltan = [v for v in variables if v["requerida"] and not v["definida"]]
    if cumple is False:
        return "malo"
    return "aviso" if faltan else "ok"


def _integraciones():
    base = _probar_base_de_datos()
    motor = connection.vendor
    puerto = str(connection.settings_dict.get("PORT") or "")
    r2 = getattr(settings, "USE_R2", False)
    modo_correo = _modo_de_correo()

    with ambito_de_plataforma():
        from apps.mensajeria.models import ConfiguracionWhatsApp  # noqa: PLC0415

        activas = list(ConfiguracionWhatsApp.objects.filter(activo=True).values_list("proveedor", flat=True))

    var_bd = _variables(("DATABASE_URL", True, "Cadena de conexión de PostgreSQL (Supabase)."))
    var_r2 = _variables(
        ("R2_ACCOUNT_ID", True, "Cuenta de Cloudflare."),
        ("R2_ACCESS_KEY_ID", True, "Clave de acceso del token de R2."),
        ("R2_SECRET_ACCESS_KEY", True, "Secreto del token de R2."),
        ("R2_BUCKET_NAME", True, "Nombre del bucket."),
        ("R2_PUBLIC_URL", False, "Dirección pública desde la que se sirven los archivos."),
    )
    var_correo = _variables(
        ("BREVO_API_KEY", modo_correo == "brevo", "Clave de la API de Brevo (backend de correo por API)."),
        ("DEFAULT_FROM_EMAIL", True, "Remitente: Nombre <correo@dominio>."),
        ("EMAIL_HOST_USER", modo_correo == "smtp", "Solo si el correo sale por SMTP."),
    )
    var_wa = _variables(
        ("META_WHATSAPP_TOKEN", False, "Token de Meta (WhatsApp Cloud API)."),
        ("META_APP_SECRET", False, "Secreto de la app, para validar los webhooks."),
        ("META_WEBHOOK_VERIFY_TOKEN", False, "Token de verificación del webhook de Meta."),
        ("TWILIO_ACCOUNT_SID", False, "Cuenta de Twilio (proveedor de respaldo)."),
        ("TWILIO_AUTH_TOKEN", False, "Token de Twilio."),
    )

    return [
        {
            "id": "base_datos",
            "estado": "ok" if base["ok"] else "malo",
            "mensaje": base["mensaje"],
            "ms": base.get("ms"),
            "detalle": {"motor": motor, "pooler": puerto == "6543"},
            "variables": var_bd,
            "puede_probar": True,
        },
        {
            "id": "almacenamiento",
            "estado": "ok" if r2 else "aviso",
            "mensaje": "Cloudflare R2 activo." if r2 else "Disco local: los archivos se pierden en cada despliegue.",
            "detalle": {"modo": "r2" if r2 else "local", "backend": type(default_storage).__name__},
            "variables": var_r2,
            "puede_probar": True,
        },
        {
            "id": "correo",
            "estado": _estado_de(var_correo) if modo_correo in ("brevo", "smtp") else "aviso",
            "mensaje": {
                "brevo": "Envía por la API de Brevo.",
                "smtp": "Envía por SMTP.",
                "consola": "Sale por consola: no se envía correo real.",
            }.get(modo_correo, "Backend de correo personalizado."),
            "detalle": {"modo": modo_correo},
            "variables": var_correo,
            "puede_probar": True,
        },
        {
            "id": "whatsapp",
            "estado": "ok" if activas else "aviso",
            "mensaje": (
                f"{len(activas)} {'empresa lo usa' if len(activas) == 1 else 'empresas lo usan'}."
                if activas
                else "Ninguna empresa lo tiene activo todavía."
            ),
            "detalle": {
                "empresas_activas": len(activas),
                "por_proveedor": {p: activas.count(p) for p in sorted(set(activas))},
            },
            "variables": var_wa,
            "puede_probar": False,
        },
    ]


class IntegracionesView(APIView):
    """GET: el estado real de cada integración, sin exponer ningún valor."""

    permission_classes = [EsStaffDePlataforma]

    def get(self, request):
        return Response(_integraciones())


class GuardarIntegracionView(APIView):
    """
    PATCH: guarda (cifradas) las variables de una integración desde el panel.

    Cuerpo: `{"valores": {"NOMBRE": "valor"}}`. Un valor vacío o `null` quita lo
    guardado y devuelve el control a la variable de entorno del servidor. Solo
    se aceptan las variables editables de esa integración; ningún valor vuelve
    en la respuesta, que es el estado actualizado de la integración.
    """

    permission_classes = [EsStaffDePlataforma]

    def patch(self, request, clave):
        from . import secretos  # noqa: PLC0415
        from .models import ConfiguracionIntegracion  # noqa: PLC0415

        permitidas = EDITABLES.get(clave)
        if permitidas is None:
            return Response({"detail": "Esta integración no se configura desde el panel."}, status=400)
        valores = request.data.get("valores")
        if not isinstance(valores, dict) or not valores:
            return Response({"valores": ["Envía al menos una variable."]}, status=400)

        errores = {}
        limpios = {}
        for nombre, bruto in valores.items():
            if nombre not in permitidas:
                errores[nombre] = "Esta variable no se puede cambiar desde aquí."
                continue
            valor = "" if bruto is None else str(bruto).strip()
            if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "\"'":
                valor = valor[1:-1].strip()  # las comillas de un .env no son parte del valor
            if len(valor) > 2000:
                errores[nombre] = "Es demasiado largo."
                continue
            if valor:
                problema = permitidas[nombre][1](valor)
                if problema:
                    errores[nombre] = problema
                    continue
            limpios[nombre] = valor
        if errores:
            return Response({"valores": errores}, status=400)

        usuario = getattr(request.user, "email_usuario", "") or str(request.user)
        for nombre, valor in limpios.items():
            if valor:
                ConfiguracionIntegracion.objects.update_or_create(
                    clave=nombre, defaults={"valor_cifrado": secretos.cifrar(valor), "actualizado_por": usuario}
                )
            else:
                ConfiguracionIntegracion.objects.filter(clave=nombre).delete()
                # Sin la fila, `settings` conserva el último valor aplicado:
                # se vuelve al del entorno para que «quitar» sea inmediato.
                import environ  # noqa: PLC0415

                setattr(settings, nombre, environ.Env()(nombre, default=""))
        secretos.sincronizar(forzar=True)

        estado = next(i for i in _integraciones() if i["id"] == clave)
        if clave == "almacenamiento":
            estado["requiere_reinicio"] = True
        return Response(estado)


class ProbarIntegracionView(APIView):
    """POST: prueba una integración ahora mismo (una sola llamada, a petición)."""

    permission_classes = [EsStaffDePlataforma]

    def post(self, request, clave):
        prueba = PRUEBAS.get(clave)
        if prueba is None:
            return Response(
                {"ok": False, "mensaje": "Esta integración no tiene una conexión única que probar."},
                status=400,
            )
        return Response(prueba())
