"""
Qué situaciones del negocio generan un WhatsApp.

Todo se decide DESPUÉS de confirmar la transacción (`on_commit`): un pedido
recién creado todavía no tiene su total —se calcula al guardar las líneas— y
uno que falla al guardarse no debe avisar de nada. Por la misma razón se
vuelve a leer el objeto: lo que llegó a la señal puede estar a medio armar.

Los cambios de estado se detectan comparando con el estado con el que el
objeto se cargó (`post_init`). La entrega por lotes del panel usa
`queryset.update()`, que no dispara señales; esa vista llama a
`pedido_cambio_estado` por su cuenta.

Nada de esto puede tumbar la operación: si algo falla al preparar un aviso,
se registra y el pedido sigue.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models.signals import post_init, post_save
from django.dispatch import receiver

from apps.contact.models import MensajeContacto
from apps.delivery.models import Envio
from apps.orders.models import Pedido

from . import servicio

logger = logging.getLogger(__name__)

#: Estado del pedido → aviso al cliente.
AVISO_POR_ESTADO = {
    "EDITADO": "PEDIDO_AJUSTADO",
    "CERRADO": "PEDIDO_CONFIRMADO",
    "ENTREGADO": "PEDIDO_ENTREGADO",
}


def pesos(valor) -> str:
    """45000 → "$45.000": como se escribe un precio en Colombia."""
    try:
        entero = int(Decimal(valor or 0).quantize(Decimal("1")))
    except Exception:  # noqa: BLE001
        return str(valor)
    return "$" + f"{entero:,}".replace(",", ".")


def nombre_negocio(tenant) -> str:
    from apps.content.models import StoreSettings  # noqa: PLC0415

    ajustes = StoreSettings.objects.filter(tenant=tenant).first()
    return (ajustes and ajustes.nombre_empresa) or getattr(tenant, "nombre", "") or "la tienda"


def primer_nombre(nombre: str) -> str:
    return (nombre or "").strip().split(" ")[0] or "cliente"


def _seguro(funcion, *args):
    try:
        funcion(*args)
    except Exception:  # noqa: BLE001 - un aviso nunca tumba la operación
        logger.exception("WhatsApp: no se pudo preparar el aviso (%s)", funcion.__name__)


def _recordar_estado(sender, instance, **kwargs):
    # Si `estado` vino diferido (`.only(...)`), leerlo dispararía una consulta
    # por objeto: se deja sin recordar y ese objeto no avisa de cambios.
    if "estado" in instance.__dict__:
        instance._estado_al_cargar = instance.estado


post_init.connect(_recordar_estado, sender=Pedido, dispatch_uid="mensajeria_estado_pedido")
post_init.connect(_recordar_estado, sender=Envio, dispatch_uid="mensajeria_estado_envio")


# ==========================================================================
# PEDIDOS
# ==========================================================================
@receiver(post_save, sender=Pedido, dispatch_uid="mensajeria_pedido_guardado")
def pedido_guardado(sender, instance, created, **kwargs):
    if created:
        transaction.on_commit(lambda: _seguro(_pedido_creado, instance.pk))
    else:
        anterior = getattr(instance, "_estado_al_cargar", None)
        if anterior is not None and anterior != instance.estado:
            pedido_cambio_estado(instance, instance.estado)
    if "estado" in instance.__dict__:
        instance._estado_al_cargar = instance.estado


def _pedido_creado(pedido_id):
    pedido = Pedido.all_tenants.select_related("cliente", "tenant").filter(pk=pedido_id).first()
    if pedido is None:
        return
    cliente = pedido.cliente
    nombre = cliente.nombre_cliente if cliente else "Cliente"
    if cliente and cliente.telefono_cliente and servicio.puede_escribir_a(pedido.tenant, cliente, "PEDIDO_RECIBIDO"):
        servicio.encolar(
            pedido.tenant,
            "PEDIDO_RECIBIDO",
            cliente.telefono_cliente,
            {
                "cliente": primer_nombre(nombre),
                "pedido": pedido.pk,
                "total": pesos(pedido.total_pedido),
                "negocio": nombre_negocio(pedido.tenant),
            },
            clave=f"pedido:{pedido.pk}:PEDIDO_RECIBIDO",
            pedido_id=pedido.pk,
        )
    servicio.alertar_negocio(
        pedido.tenant,
        "ALERTA_PEDIDO_NUEVO",
        {"pedido": pedido.pk, "cliente": nombre, "total": pesos(pedido.total_pedido)},
        clave=f"pedido:{pedido.pk}:ALERTA_PEDIDO_NUEVO",
        pedido_id=pedido.pk,
    )


def pedido_cambio_estado(pedido, estado: str) -> None:
    """Avisa al cliente del nuevo estado. Público: lo usa la entrega por lotes."""
    evento = AVISO_POR_ESTADO.get(estado)
    if evento:
        pedido_id = pedido.pk
        transaction.on_commit(lambda: _seguro(_avisar_estado, pedido_id, evento))


def _avisar_estado(pedido_id, evento):
    pedido = Pedido.all_tenants.select_related("cliente", "tenant").filter(pk=pedido_id).first()
    if pedido is None or not pedido.cliente or not pedido.cliente.telefono_cliente:
        return
    if not servicio.puede_escribir_a(pedido.tenant, pedido.cliente, evento):
        return
    servicio.encolar(
        pedido.tenant,
        evento,
        pedido.cliente.telefono_cliente,
        {
            "cliente": primer_nombre(pedido.cliente.nombre_cliente),
            "pedido": pedido.pk,
            "total": pesos(pedido.total_pedido),
            "negocio": nombre_negocio(pedido.tenant),
        },
        clave=f"pedido:{pedido.pk}:{evento}",
        pedido_id=pedido.pk,
    )


# ==========================================================================
# DOMICILIOS
# ==========================================================================
@receiver(post_save, sender=Envio, dispatch_uid="mensajeria_envio_guardado")
def envio_guardado(sender, instance, created, **kwargs):
    anterior = getattr(instance, "_estado_al_cargar", None)
    if not created and anterior is not None and anterior != instance.estado:
        if instance.estado in (Envio.Estado.EN_RUTA, Envio.Estado.DEVUELTO):
            envio_id, estado = instance.pk, instance.estado
            transaction.on_commit(lambda: _seguro(_avisar_envio, envio_id, estado))
    if "estado" in instance.__dict__:
        instance._estado_al_cargar = instance.estado


def _avisar_envio(envio_id, estado):
    envio = Envio.all_tenants.select_related("repartidor", "pedido", "cliente", "tenant").filter(pk=envio_id).first()
    if envio is None:
        return
    referencia = envio.pedido_id or envio.pk
    if estado == Envio.Estado.EN_RUTA:
        if not servicio.puede_escribir_a(envio.tenant, envio.cliente, "PEDIDO_EN_CAMINO"):
            return
        telefono = envio.telefono_contacto or (envio.cliente and envio.cliente.telefono_cliente)
        servicio.encolar(
            envio.tenant,
            "PEDIDO_EN_CAMINO",
            telefono,
            {
                "cliente": primer_nombre(envio.nombre_contacto),
                "pedido": referencia,
                "repartidor": envio.repartidor.nombre if envio.repartidor else "nuestro repartidor",
            },
            clave=f"envio:{envio.pk}:PEDIDO_EN_CAMINO",
            pedido_id=envio.pedido_id,
        )
    else:
        servicio.alertar_negocio(
            envio.tenant,
            "ALERTA_ENVIO_DEVUELTO",
            {"pedido": referencia, "cliente": envio.nombre_contacto, "nota": envio.nota or "sin nota"},
            clave=f"envio:{envio.pk}:ALERTA_ENVIO_DEVUELTO",
            pedido_id=envio.pedido_id,
        )


# ==========================================================================
# CONTACTO
# ==========================================================================
@receiver(post_save, sender=MensajeContacto, dispatch_uid="mensajeria_contacto_nuevo")
def contacto_nuevo(sender, instance, created, **kwargs):
    if not created:
        return
    mensaje_id = instance.pk
    transaction.on_commit(lambda: _seguro(_alertar_contacto, mensaje_id))


def _alertar_contacto(mensaje_id):
    mensaje = MensajeContacto.all_tenants.select_related("tenant").filter(pk=mensaje_id).first()
    if mensaje is None:
        return
    servicio.alertar_negocio(
        mensaje.tenant,
        "ALERTA_MENSAJE_CONTACTO",
        {
            "cliente": mensaje.nombre,
            "motivo": mensaje.get_motivo_display(),
            "telefono": mensaje.telefono or mensaje.email or "sin teléfono",
        },
        clave=f"contacto:{mensaje.pk}",
    )
