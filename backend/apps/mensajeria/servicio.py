"""
Enviar WhatsApp desde cualquier parte del sistema.

Tres puertas, y ninguna envía directamente:

    encolar(tenant, evento, telefono, variables, clave=…)     a una persona
    alertar_negocio(tenant, evento, variables, clave=…)       al equipo del negocio
    alertar(tenant, titulo, detalle)                          aviso libre al equipo

Las tres dejan un `MensajeWhatsApp` PENDIENTE y lo despachan cuando la
transacción que lo originó se confirma. Así un pedido que falla al guardarse
no avisa de nada, y un aviso que falla al enviarse no tumba el pedido: el
cliente compra aunque Meta esté caído, y el mensaje sale después.

Cómo se envía (`enviar`):
1. Proveedor principal del negocio (Meta o Twilio).
2. Si falla y el respaldo está activo, el otro.
3. Si fallan los dos por algo pasajero, se reprograma con espera creciente
   (1, 5, 15, 60 min). Si es definitivo —número inválido, plantilla sin
   aprobar— queda FALLIDO con el motivo, sin insistir.

Lo que no salió al momento lo recoge `manage.py enviar_whatsapp`.
"""
import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, close_old_connections, transaction
from django.db.models import Q
from django.utils import timezone

from .eventos import EVENTOS, NEGOCIO, renderizar, variables_de
from .models import ConfiguracionWhatsApp, ExclusionWhatsApp, MensajeWhatsApp, PlantillaWhatsApp
from .proveedores import PROVEEDORES, RESPALDO, ProveedorNoConfigurado, Resultado
from .telefonos import normalizar_e164

logger = logging.getLogger(__name__)

#: Espera antes de cada nueva ronda; su longitud es el máximo de rondas.
ESPERAS = [timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=15), timedelta(hours=1)]
#: Mientras un proceso envía un mensaje, nadie más lo toma.
RESERVA = timedelta(minutes=5)

Estado = MensajeWhatsApp.Estado


def configuracion(tenant) -> ConfiguracionWhatsApp | None:
    return ConfiguracionWhatsApp.all_tenants.filter(tenant=tenant).first()


def puede_escribir_a(tenant, cliente) -> bool:
    """
    ¿Se le puede enviar un aviso a este cliente? Solo si aceptó recibirlos,
    salvo que el negocio haya apagado esa exigencia. Las alertas al equipo
    del negocio no pasan por aquí.
    """
    config = configuracion(tenant)
    if config is not None and not config.exige_consentimiento:
        return True
    return bool(cliente is not None and cliente.acepta_whatsapp)


# ==========================================================================
# ENCOLAR
# ==========================================================================
def encolar(tenant, evento: str, telefono, variables, *, clave: str = "", pedido_id=None):
    """
    Deja un mensaje listo para enviar. Devuelve el mensaje, o `None` si no
    corresponde enviar nada (WhatsApp apagado, evento apagado, número que no
    se entiende o que pidió la baja, o ya encolado con esa clave).

    `variables` puede ser un dict con los nombres de `EVENTOS[evento]` o una
    lista ya ordenada.
    """
    if evento not in EVENTOS:
        raise ValueError(f"Evento de WhatsApp desconocido: {evento}")

    config = configuracion(tenant)
    if not config or not config.activo or not config.evento_activo(evento):
        return None

    destino = normalizar_e164(telefono)
    if not destino:
        logger.info("WhatsApp %s omitido: teléfono no interpretable %r", evento, telefono)
        return None
    if ExclusionWhatsApp.all_tenants.filter(tenant=tenant, telefono=destino).exists():
        return None
    if clave and MensajeWhatsApp.all_tenants.filter(tenant=tenant, clave=clave).exists():
        return None

    valores = _ordenar(evento, variables)
    plantilla = PlantillaWhatsApp.all_tenants.filter(tenant=tenant, evento=evento, activa=True).first()
    texto = renderizar((plantilla and plantilla.cuerpo) or EVENTOS[evento]["texto"], valores)

    datos = dict(
        tenant=tenant, evento=evento, destino=destino, variables=valores,
        texto=texto, clave=clave, pedido_id=pedido_id,
    )
    if plantilla is None:
        # Se registra igual, OMITIDO, para que en el panel se vea por qué no salió.
        datos.update(estado=Estado.OMITIDO, error="No hay plantilla activa para este evento.")

    try:
        with transaction.atomic():
            mensaje = MensajeWhatsApp.all_tenants.create(**datos)
    except IntegrityError:
        return None  # otra petición lo encoló a la vez con la misma clave

    if mensaje.estado == Estado.PENDIENTE:
        transaction.on_commit(lambda: _despachar(mensaje.id))
    return mensaje


def alertar_negocio(tenant, evento: str, variables, *, clave: str = "", pedido_id=None) -> list:
    """El mismo aviso a cada teléfono de alertas del negocio."""
    if EVENTOS.get(evento, {}).get("destinatario") != NEGOCIO:
        raise ValueError(f"{evento} no es una alerta para el negocio.")
    config = configuracion(tenant)
    if not config or not config.activo:
        return []
    enviados = []
    for telefono in config.telefonos_alertas or []:
        destino = normalizar_e164(telefono)
        mensaje = encolar(
            tenant, evento, telefono, variables,
            clave=f"{clave}:{destino}" if clave else "", pedido_id=pedido_id,
        )
        if mensaje:
            enviados.append(mensaje)
    return enviados


def alertar(tenant, titulo: str, detalle: str, *, clave: str = "") -> list:
    """Cualquier situación que el equipo deba saber ya, sin plantilla propia."""
    return alertar_negocio(tenant, "ALERTA_GENERAL", {"titulo": titulo, "detalle": detalle}, clave=clave)


def _ordenar(evento: str, variables) -> list[str]:
    nombres = variables_de(evento)
    if isinstance(variables, dict):
        return [str(variables.get(n, "") or "-") for n in nombres]
    lista = [str(v) for v in (variables or [])]
    return (lista + ["-"] * len(nombres))[: len(nombres)]


# ==========================================================================
# ENVIAR
# ==========================================================================
def _despachar(mensaje_id: int) -> None:
    """Tras confirmar la transacción: envía ya (en un hilo, para no hacer
    esperar la respuesta al cliente) o lo deja para el comando."""
    if not getattr(settings, "WHATSAPP_ENVIO_INMEDIATO", True):
        return
    if getattr(settings, "WHATSAPP_ENVIO_EN_HILO", True):
        threading.Thread(target=_enviar_en_hilo, args=(mensaje_id,), daemon=True).start()
    else:
        enviar_por_id(mensaje_id)


def _enviar_en_hilo(mensaje_id: int) -> None:
    try:
        enviar_por_id(mensaje_id)
        # De paso, lo que estaba reprogramado y ya le llegó la hora. En el plan
        # gratuito de Render no hay cron: así los reintentos salen con la
        # siguiente actividad del sistema, sin depender de un proceso aparte.
        procesar_pendientes(limite=10)
    except Exception:  # noqa: BLE001 - un hilo suelto no debe morir en silencio
        logger.exception("WhatsApp: error inesperado enviando el mensaje %s", mensaje_id)
    finally:
        close_old_connections()


def _reservar(mensaje_id: int) -> bool:
    """
    Toma el mensaje para este proceso. Es un UPDATE condicional y no un
    `select_for_update`: no deja una transacción abierta mientras se espera a
    Meta, y funciona igual en SQLite. Si el hilo del pedido y el comando lo
    intentan a la vez, solo uno gana.
    """
    ahora = timezone.now()
    return bool(
        MensajeWhatsApp.all_tenants.filter(id=mensaje_id, estado=Estado.PENDIENTE)
        .filter(Q(proximo_intento__isnull=True) | Q(proximo_intento__lte=ahora))
        .update(proximo_intento=ahora + RESERVA)
    )


def enviar_por_id(mensaje_id: int) -> bool:
    if not _reservar(mensaje_id):
        return False
    return enviar(MensajeWhatsApp.all_tenants.get(id=mensaje_id))


def enviar(mensaje: MensajeWhatsApp) -> bool:
    config = configuracion(mensaje.tenant)
    plantilla = PlantillaWhatsApp.all_tenants.filter(
        tenant=mensaje.tenant, evento=mensaje.evento, activa=True
    ).first()
    if not config or not config.activo or plantilla is None:
        mensaje.estado = Estado.OMITIDO
        mensaje.error = "WhatsApp apagado o sin plantilla activa al momento de enviar."
        mensaje.proximo_intento = None
        mensaje.save(update_fields=["estado", "error", "proximo_intento", "fecha_actualizacion"])
        return False

    ronda = 1 + max((i.get("ronda", 0) for i in mensaje.intentos), default=0)
    orden = [config.proveedor]
    if config.respaldo_activo and config.proveedor in RESPALDO:
        orden.append(RESPALDO[config.proveedor])

    reintentable = False
    for nombre in orden:
        proveedor = PROVEEDORES[nombre](config)
        try:
            if not proveedor.disponible():
                raise ProveedorNoConfigurado(f"{nombre} no está configurado para este negocio.")
            resultado = proveedor.enviar(mensaje.destino, plantilla, mensaje.variables)
        except ProveedorNoConfigurado as e:
            resultado = Resultado(ok=False, error=str(e))
        except Exception as e:  # noqa: BLE001 - cualquier fallo del proveedor se registra
            logger.exception("WhatsApp: %s lanzó una excepción", nombre)
            resultado = Resultado(ok=False, error=f"{type(e).__name__}: {e}", reintentable=True)

        mensaje.intentos = [
            *mensaje.intentos,
            {
                "ronda": ronda,
                "proveedor": nombre,
                "ok": resultado.ok,
                "error": resultado.error,
                "fecha": timezone.now().isoformat(),
            },
        ]
        if resultado.ok:
            mensaje.estado = Estado.ENVIADO
            mensaje.proveedor = nombre
            mensaje.id_externo = resultado.id_externo
            mensaje.error = ""
            mensaje.proximo_intento = None
            mensaje.fecha_envio = timezone.now()
            mensaje.save()
            return True
        reintentable = reintentable or resultado.reintentable
        mensaje.error = resultado.error

    if reintentable and ronda <= len(ESPERAS):
        mensaje.proximo_intento = timezone.now() + ESPERAS[ronda - 1]
    else:
        mensaje.estado = Estado.FALLIDO
        mensaje.proximo_intento = None
    mensaje.save()
    return False


def procesar_pendientes(limite: int = 50) -> int:
    """Envía lo que esté pendiente y le haya llegado la hora. Devuelve cuántos salieron."""
    ahora = timezone.now()
    ids = list(
        MensajeWhatsApp.all_tenants.filter(estado=Estado.PENDIENTE)
        .filter(Q(proximo_intento__isnull=True) | Q(proximo_intento__lte=ahora))
        .order_by("fecha_creacion")
        .values_list("id", flat=True)[:limite]
    )
    return sum(1 for i in ids if enviar_por_id(i))


def reintentar(mensaje: MensajeWhatsApp) -> None:
    """Desde el panel: vuelve a poner en cola un mensaje fallido u omitido."""
    mensaje.estado = Estado.PENDIENTE
    mensaje.proximo_intento = None
    mensaje.error = ""
    mensaje.save(update_fields=["estado", "proximo_intento", "error", "fecha_actualizacion"])
    transaction.on_commit(lambda: _despachar(mensaje.id))


# ==========================================================================
# ESTADOS QUE LLEGAN DE META Y TWILIO
# ==========================================================================
#: Un estado solo avanza: un «entregado» que llega tarde no debe tapar un «leído».
ORDEN_ESTADOS = {Estado.ENVIADO: 1, Estado.ENTREGADO: 2, Estado.LEIDO: 3}

ESTADOS_EXTERNOS = {
    # Meta
    "sent": Estado.ENVIADO,
    "delivered": Estado.ENTREGADO,
    "read": Estado.LEIDO,
    "failed": Estado.FALLIDO,
    # Twilio
    "queued": Estado.ENVIADO,
    "accepted": Estado.ENVIADO,
    "sending": Estado.ENVIADO,
    "undelivered": Estado.FALLIDO,
}


def actualizar_estado(id_externo: str, estado_externo: str, error: str = "") -> bool:
    nuevo = ESTADOS_EXTERNOS.get((estado_externo or "").lower())
    if not id_externo or nuevo is None:
        return False
    mensaje = MensajeWhatsApp.all_tenants.filter(id_externo=id_externo).first()
    if mensaje is None:
        return False
    if nuevo == Estado.FALLIDO:
        if mensaje.estado == Estado.LEIDO:
            return False
        mensaje.error = error or "El proveedor informó que no se pudo entregar."
    elif ORDEN_ESTADOS.get(nuevo, 0) <= ORDEN_ESTADOS.get(mensaje.estado, 0):
        return False
    mensaje.estado = nuevo
    mensaje.save(update_fields=["estado", "error", "fecha_actualizacion"])
    return True


PALABRAS_BAJA = {"baja", "stop", "parar", "cancelar", "no mas", "no más", "salir"}


def registrar_respuesta(tenant, telefono: str, texto: str) -> bool:
    """Un mensaje entrante. Si pide la baja, el número queda excluido."""
    destino = normalizar_e164(telefono)
    if not tenant or not destino:
        return False
    if " ".join((texto or "").lower().split()) in PALABRAS_BAJA:
        ExclusionWhatsApp.all_tenants.get_or_create(
            tenant=tenant, telefono=destino, defaults={"motivo": "El cliente respondió pidiendo la baja."}
        )
        _retirar_consentimiento(tenant, destino)
        return True
    return False


def _retirar_consentimiento(tenant, destino: str) -> None:
    """La baja también queda en el cliente, con su fecha: es su decisión."""
    from apps.orders.models import Cliente  # noqa: PLC0415

    # Se compara normalizado y no con un filtro de texto: el teléfono se guarda
    # como lo escribió el cliente ("+57 300 123 4567"). Solo se recorren los que
    # tienen el consentimiento activo, que son los únicos que importan.
    candidatos = Cliente.all_tenants.filter(tenant=tenant, acepta_whatsapp=True).only(
        "id", "telefono_cliente", "acepta_whatsapp", "whatsapp_decidido_en"
    )
    for cliente in candidatos.iterator():
        if normalizar_e164(cliente.telefono_cliente) == destino:
            cliente.acepta_whatsapp = False
            cliente.whatsapp_decidido_en = timezone.now()
            cliente.save(update_fields=["acepta_whatsapp", "whatsapp_decidido_en"])
