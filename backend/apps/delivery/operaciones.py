"""
Lo que se hace con un envío: crearlo, asignarlo y moverlo de estado.

Mismo reparto que en el resto del sistema —`inventory/operaciones.py`,
`pos/operaciones.py`, `reservations/operaciones.py`—: las vistas traducen HTTP y
aquí vive la regla. Un envío lo va a crear el panel, la caja, la tienda y algún
día un bot de WhatsApp, y una regla escrita en la vista solo la cumple quien
pasa por esa vista.

# Qué se disputa aquí

En reservas el recurso escaso era la mesa. Aquí es EL REPARTIDOR: una moto
lleva tres o cuatro pedidos y ya. Así que `asignar()` bloquea la fila del
repartidor —`select_for_update`— antes de contar lo que lleva encima, que es
literalmente el mismo movimiento que `reservations.crear()` hace con la mesa y
que `pos` hace con el turno para numerar sus ventas.

Que el segundo módulo con panel se haya topado con la MISMA forma de problema
—un recurso con un tope, dos peticiones a la vez— es en sí mismo el dato que
esta fase buscaba. La tercera vez que aparece un patrón deja de ser casualidad;
si aparece una cuarta, ahí sí valdrá la pena sacarlo a una utilidad. Hoy no:
extraer sobre dos ejemplos es cómo se fabrica una abstracción que no encaja en
el tercero.

# Por qué crear no bloquea nada

Porque crear un envío no compite con nadie: la dirección de un cliente no es un
recurso escaso. Lo que puede fallar es asignarlo, y por eso la validación cara
está ahí y no antes. Un envío nace PENDIENTE —«por asignar»— y eso no es un
estado de relleno: es exactamente la bandeja que mira quien despacha.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import ConfiguracionEnvios, Envio, Repartidor, Zona


class ErrorDeEnvio(Exception):
    """Base de los fallos que esta capa sabe explicarle a quien despacha."""


class FueraDeCobertura(ErrorDeEnvio):
    """El negocio solo reparte en sus zonas y esta dirección no está en ninguna."""


class RepartidorLleno(ErrorDeEnvio):
    """Ya lleva todo lo que puede llevar."""


class CambioNoPermitido(ErrorDeEnvio):
    """El estado al que se quiere pasar no sale del actual."""


#: De dónde sale cada estado. Un entregado no vuelve a estar en ruta, y un
#: cancelado no revive: si el cliente vuelve a pedir, es un envío nuevo.
#: Escrito como tabla y no como condiciones sueltas por lo mismo que en
#: reservas: es lo que permite pintar los botones que de verdad se pueden
#: pulsar en vez de adivinarlos en el frontend.
#:
#: DEVUELTO sale de EN_RUTA y no de ASIGNADO a propósito: para devolver algo
#: hay que haber ido, y un envío que nunca salió del local se cancela.
TRANSICIONES = {
    Envio.Estado.PENDIENTE: (
        Envio.Estado.ASIGNADO,
        Envio.Estado.CANCELADO,
    ),
    Envio.Estado.ASIGNADO: (
        Envio.Estado.EN_RUTA,
        Envio.Estado.PENDIENTE,  # se lo quitan al repartidor y vuelve a la bandeja
        Envio.Estado.CANCELADO,
    ),
    Envio.Estado.EN_RUTA: (
        Envio.Estado.ENTREGADO,
        Envio.Estado.DEVUELTO,
    ),
    Envio.Estado.ENTREGADO: (),
    Envio.Estado.DEVUELTO: (),
    Envio.Estado.CANCELADO: (),
}


# ==========================================================================
# CONFIGURACIÓN
# ==========================================================================
def configuracion(tenant) -> ConfiguracionEnvios:
    """
    La configuración de este negocio, creándola si es su primera vez.

    Se crea aquí y no al activar el módulo por lo mismo que la caja siembra sus
    medios de pago al abrir el primer turno, y que reservas crea la suya: un
    negocio puede tener domicilios contratados semanas antes de estrenarlos, y
    lo que no puede es que el primer envío falle porque nadie pulsó nada.
    """
    tenant_id = getattr(tenant, "pk", tenant)
    config, _ = ConfiguracionEnvios.all_tenants.get_or_create(tenant_id=tenant_id)
    return config


# ==========================================================================
# TARIFA Y PROMESA
# ==========================================================================
def tarifa_de(config, zona) -> Decimal:
    """
    Lo que cuesta llegar allá.

    La zona manda; si no hay zona, manda la tarifa base del negocio; y si el
    negocio dijo que solo reparte en sus zonas, no hay tarifa: hay un no.
    """
    if zona is not None:
        return zona.tarifa
    if config.exige_zona:
        raise FueraDeCobertura(
            "Este negocio solo reparte en sus zonas y no se eligió ninguna."
        )
    return config.tarifa_base


def promesa_de(config, zona) -> timedelta:
    """Cuánto se promete tardar. La zona puede decir lo suyo; 0 es «heredado»."""
    minutos = (zona.minutos_de_promesa if zona is not None else 0) or config.minutos_de_promesa
    return timedelta(minutes=minutos)


# ==========================================================================
# CARGA DEL REPARTIDOR
# ==========================================================================
def carga(repartidor):
    """Los envíos que lleva encima ahora mismo."""
    return Envio.all_tenants.filter(
        tenant_id=repartidor.tenant_id,
        repartidor=repartidor,
        estado__in=Envio.ESTADOS_EN_CALLE,
    )


def puede_cargar(repartidor, *, excluir=None) -> bool:
    consulta = carga(repartidor)
    if excluir is not None:
        consulta = consulta.exclude(pk=excluir)
    return consulta.count() < repartidor.carga_maxima


def disponibles(tenant):
    """Los repartidores activos a los que todavía les cabe algo."""
    tenant_id = getattr(tenant, "pk", tenant)
    return [
        r
        for r in Repartidor.all_tenants.filter(tenant_id=tenant_id, activo=True)
        if puede_cargar(r)
    ]


# ==========================================================================
# CONSULTAS DEL TABLERO
# ==========================================================================
def tablero(tenant, *, desde=None, hasta=None, estados=None):
    """
    Lo que hay que despachar. Es la consulta que pinta la pantalla.

    Sin ventana devuelve solo lo que sigue vivo —pendiente, asignado, en ruta—
    y no el histórico entero, porque quien abre esta pantalla está despachando,
    no auditando. Con ventana devuelve todo lo de ese rango, que es el modo
    auditoría.
    """
    tenant_id = getattr(tenant, "pk", tenant)
    consulta = Envio.all_tenants.filter(tenant_id=tenant_id).select_related(
        "zona", "repartidor", "cliente"
    )
    if desde is not None:
        consulta = consulta.filter(fecha_creacion__gte=desde)
    if hasta is not None:
        consulta = consulta.filter(fecha_creacion__lt=hasta)
    if estados:
        consulta = consulta.filter(estado__in=estados)
    elif desde is None and hasta is None:
        vivos = [Envio.Estado.PENDIENTE, *Envio.ESTADOS_EN_CALLE]
        consulta = consulta.filter(estado__in=vivos)
    return consulta.order_by("estado", "prometido_para", "id")


# ==========================================================================
# CREAR
# ==========================================================================
@transaction.atomic
def crear(
    tenant,
    *,
    direccion,
    zona=None,
    nombre_contacto="",
    telefono_contacto="",
    referencia="",
    cliente=None,
    tarifa=None,
    cobro_contra_entrega=False,
    monto_a_cobrar=0,
    nota="",
    origen=Envio.Origen.PANEL,
    usuario=None,
    venta=None,
    pedido=None,
) -> Envio:
    """
    Anota que algo tiene que llegar a una dirección.

    `tarifa` se puede forzar —el dueño perdona el domicilio de un cliente
    fiel—, y si no viene la pone la zona. Lo que se guarda es el número, no la
    zona: mañana la zona cuesta otra cosa y este envío se cobró a lo de hoy.
    """
    config = configuracion(tenant)
    tenant_id = getattr(tenant, "pk", tenant)

    direccion = (direccion or "").strip()
    if not direccion:
        raise ErrorDeEnvio("Un domicilio necesita una dirección a donde ir.")

    # El nombre y el teléfono se COPIAN del cliente cuando no los dan a mano.
    # Copiados, no referenciados: dentro de un año este envío tiene que seguir
    # diciendo a dónde se llevó aunque el cliente se haya mudado.
    if not nombre_contacto and cliente is not None:
        nombre_contacto = getattr(cliente, "nombre_cliente", "") or str(cliente)
    if not telefono_contacto and cliente is not None:
        telefono_contacto = getattr(cliente, "telefono_cliente", "") or ""

    if not nombre_contacto:
        raise ErrorDeEnvio("Un domicilio necesita un nombre a quien entregarlo.")

    if tarifa is None:
        tarifa = tarifa_de(config, zona)
    elif zona is None and config.exige_zona:
        # Perdonar la tarifa no perdona la cobertura: son dos decisiones
        # distintas y confundirlas dejaría entrar envíos a donde no se llega.
        raise FueraDeCobertura(
            "Este negocio solo reparte en sus zonas y no se eligió ninguna."
        )

    if cobro_contra_entrega and Decimal(monto_a_cobrar or 0) <= 0:
        raise ErrorDeEnvio(
            "Un envío contra entrega tiene que decir cuánto hay que cobrar."
        )

    return Envio.all_tenants.create(
        tenant_id=tenant_id,
        zona=zona,
        cliente=cliente,
        nombre_contacto=nombre_contacto[:120],
        telefono_contacto=(telefono_contacto or "")[:40],
        direccion=direccion,
        referencia=(referencia or "")[:200],
        tarifa=tarifa,
        cobro_contra_entrega=bool(cobro_contra_entrega),
        monto_a_cobrar=monto_a_cobrar or 0,
        prometido_para=timezone.now() + promesa_de(config, zona),
        origen=origen,
        nota=nota,
        creado_por=usuario,
        venta=venta,
        pedido=pedido,
    )


# ==========================================================================
# ASIGNAR
# ==========================================================================
@transaction.atomic
def asignar(envio, repartidor) -> Envio:
    """
    Le entrega el envío a alguien, si le cabe.

    Aquí está el bloqueo, y por la misma razón que en reservas: entre CONTAR lo
    que lleva y ESCRIBIR que lleva uno más hay una ventana, y dos despachadores
    dentro de esa ventana le cuelgan el último hueco al mismo repartidor. Lo
    que se sostiene es la fila del repartidor, porque el repartidor es lo que
    se disputa.
    """
    if envio.cerrado:
        raise CambioNoPermitido(
            f"El envío está {envio.get_estado_display().lower()}; ya no se reasigna."
        )

    repartidor = Repartidor.all_tenants.select_for_update().get(pk=repartidor.pk)

    if not repartidor.activo:
        raise ErrorDeEnvio(f"{repartidor.nombre} no está disponible.")

    # Se excluye a sí mismo: reasignarle a alguien un envío que YA lleva no
    # debería chocar contra su propio hueco. Es el mismo cuidado que
    # `reservations.reprogramar()` tiene al mover una reserva.
    if not puede_cargar(repartidor, excluir=envio.pk):
        raise RepartidorLleno(
            f"{repartidor.nombre} ya lleva {repartidor.carga_maxima} envíos."
        )

    envio.repartidor = repartidor
    campos = ["repartidor"]
    if envio.estado == Envio.Estado.PENDIENTE:
        envio.estado = Envio.Estado.ASIGNADO
        campos.append("estado")
    envio.save(update_fields=campos)
    return envio


# ==========================================================================
# ESTADOS
# ==========================================================================
def cambiar_estado(envio, estado, *, nota=None) -> Envio:
    """
    Avanza el envío por su tabla de transiciones, estampando las horas.

    No hay un método por estado —`despachar()`, `entregar()`, `devolver()`—
    porque serían cinco funciones idénticas alrededor de la misma tabla, y la
    sexta se olvidaría de consultarla.

    Las marcas de tiempo se ponen AQUÍ y no en la vista porque son parte de lo
    que significa el cambio: un envío en ruta sin hora de salida no permite
    saber si va tarde, que es la única pregunta que alguien le hace a esta
    pantalla.
    """
    if estado == envio.estado:
        return envio

    permitidos = TRANSICIONES.get(envio.estado, ())
    if estado not in permitidos:
        raise CambioNoPermitido(
            f"Un envío {envio.get_estado_display().lower()} no puede pasar a "
            f"«{Envio.Estado(estado).label.lower()}»."
        )

    if estado in Envio.ESTADOS_EN_CALLE and envio.repartidor_id is None:
        raise CambioNoPermitido("Nadie lo lleva todavía: primero hay que asignarlo.")

    campos = ["estado"]
    envio.estado = estado

    if estado == Envio.Estado.EN_RUTA and envio.salida is None:
        envio.salida = timezone.now()
        campos.append("salida")
    if estado in (Envio.Estado.ENTREGADO, Envio.Estado.DEVUELTO):
        envio.entrega = timezone.now()
        campos.append("entrega")
    if estado == Envio.Estado.PENDIENTE:
        # Se lo quitaron al repartidor: vuelve a la bandeja SIN dueño, o
        # seguiría contando en su carga sin que nadie lo esté llevando.
        envio.repartidor = None
        campos.append("repartidor")

    if nota is not None:
        envio.nota = nota
        campos.append("nota")

    envio.save(update_fields=campos)
    return envio


@transaction.atomic
def enlazar_venta(envio, venta) -> Envio:
    """
    Cuelga del envío la venta que lo pagó.

    La clave foránea va en esta dirección —de envío a venta, y desde este
    módulo— y esa asimetría es la que sostiene toda la fase: el POS puede
    seguir sin saber que los domicilios existen. Lo que él guardó fue un
    diccionario opaco en `Venta.contexto`, y quien lo interpreta es esto.
    """
    if envio.venta_id and envio.venta_id != venta.pk:
        raise ErrorDeEnvio("Este envío ya está enlazado a otra venta.")

    envio.venta = venta
    envio.save(update_fields=["venta"])
    return envio


def zonas_activas(tenant):
    tenant_id = getattr(tenant, "pk", tenant)
    return Zona.all_tenants.filter(tenant_id=tenant_id, activa=True)
