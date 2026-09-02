"""
Lo que se hace con una reserva: crearla, moverla y cambiarle el estado.

Mismo reparto que en el resto del sistema —`inventory/operaciones.py`,
`pos/operaciones.py`—: las vistas traducen HTTP y aquí vive la regla. La razón
sigue siendo la de siempre: la reserva la va a crear el panel, la caja y algún
día la tienda online, y una regla escrita en la vista solo la cumple quien pasa
por esa vista.

# El bloqueo, y por qué no basta con preguntar

Comprobar el solapamiento con un `SELECT` y luego insertar es la carrera de
libro: dos peticiones preguntan a la vez, las dos ven el hueco libre, las dos
insertan. Entre preguntar y escribir hay que sostener algo, y lo que se sostiene
es la fila del RECURSO —`select_for_update`— porque el recurso es lo que se
disputa. Es la misma técnica con que la caja numera sus ventas bloqueando el
turno, y por el mismo motivo: bloquear la tabla entera serializaría el negocio;
bloquear la fila solo serializa a los dos que se pelean por la misma mesa.
"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import ConfiguracionReservas, Recurso, Reserva


class ErrorDeReserva(Exception):
    """Base de los fallos que esta capa sabe explicarle a quien atiende."""


class RecursoOcupado(ErrorDeReserva):
    """Ya hay alguien en ese hueco."""


class CambioNoPermitido(ErrorDeReserva):
    """El estado al que se quiere pasar no sale del actual."""


#: De dónde sale cada estado. Una reserva cumplida no vuelve a pendiente, y una
#: cancelada no revive: si alguien vuelve, es una reserva nueva. Escribirlo como
#: tabla y no como condiciones sueltas es lo que permite pintar en pantalla los
#: botones que de verdad se pueden pulsar, en vez de adivinarlos.
TRANSICIONES = {
    Reserva.Estado.PENDIENTE: (
        Reserva.Estado.CONFIRMADA,
        Reserva.Estado.EN_CURSO,
        Reserva.Estado.CANCELADA,
        Reserva.Estado.NO_ASISTIO,
    ),
    Reserva.Estado.CONFIRMADA: (
        Reserva.Estado.EN_CURSO,
        Reserva.Estado.CANCELADA,
        Reserva.Estado.NO_ASISTIO,
    ),
    Reserva.Estado.EN_CURSO: (
        Reserva.Estado.CUMPLIDA,
        Reserva.Estado.CANCELADA,
    ),
    Reserva.Estado.CUMPLIDA: (),
    Reserva.Estado.CANCELADA: (),
    Reserva.Estado.NO_ASISTIO: (),
}


# ==========================================================================
# CONFIGURACIÓN
# ==========================================================================
def configuracion(tenant) -> ConfiguracionReservas:
    """
    La configuración de este negocio, creándola si es su primera vez.

    Se crea aquí y no al activar el módulo por lo mismo que la caja siembra sus
    medios de pago al abrir el primer turno: un negocio puede tener reservas
    contratadas semanas antes de estrenarlas, y lo que no puede es que la
    primera reserva falle porque nadie pulsó nada.
    """
    tenant_id = getattr(tenant, "pk", tenant)
    config, _ = ConfiguracionReservas.all_tenants.get_or_create(tenant_id=tenant_id)
    return config


# ==========================================================================
# DISPONIBILIDAD
# ==========================================================================
def solapadas(recurso, inicio, fin, *, excluir=None):
    """
    Las reservas vivas que pisan este intervalo.

    Dos intervalos se cruzan si cada uno empieza antes de que acabe el otro. Se
    escribe así —y no enumerando los cuatro casos— porque los cuatro casos es
    donde se olvida siempre uno. Los extremos NO cuentan: una reserva de 20:00
    a 21:30 deja libre la de 21:30, que es como lo entiende cualquiera que
    reparta mesas.
    """
    consulta = Reserva.all_tenants.filter(
        tenant_id=recurso.tenant_id,
        recurso=recurso,
        estado__in=Reserva.ESTADOS_QUE_OCUPAN,
        inicio__lt=fin,
        fin__gt=inicio,
    )
    if excluir is not None:
        consulta = consulta.exclude(pk=excluir)
    return consulta


def hay_sitio(recurso, inicio, fin, *, excluir=None) -> bool:
    return (
        solapadas(recurso, inicio, fin, excluir=excluir).count()
        < recurso.reservas_simultaneas
    )


def libres(tenant, inicio, fin):
    """Los recursos activos que admiten una reserva más en ese hueco."""
    tenant_id = getattr(tenant, "pk", tenant)
    recursos = Recurso.all_tenants.filter(tenant_id=tenant_id, activo=True)
    return [r for r in recursos if hay_sitio(r, inicio, fin)]


def agenda(tenant, desde, hasta, *, recurso=None):
    """Lo que hay entre dos momentos. Es la consulta que pinta la pantalla."""
    tenant_id = getattr(tenant, "pk", tenant)
    consulta = Reserva.all_tenants.filter(
        tenant_id=tenant_id, inicio__lt=hasta, fin__gt=desde
    ).select_related("recurso", "cliente")
    if recurso is not None:
        consulta = consulta.filter(recurso=recurso)
    return consulta.order_by("inicio", "id")


# ==========================================================================
# CREAR Y MOVER
# ==========================================================================
def _validar_hueco(config, recurso, inicio, fin, personas):
    if fin <= inicio:
        raise ErrorDeReserva("Una reserva tiene que terminar después de empezar.")

    if not recurso.activo:
        raise ErrorDeReserva(f"{recurso.nombre} no está disponible para reservas.")

    limite = timezone.now() + timedelta(days=config.antelacion_maxima_dias)
    if inicio > limite:
        raise ErrorDeReserva(
            f"No se puede reservar con más de {config.antelacion_maxima_dias} días "
            "de antelación."
        )

    # La capacidad solo se valida cuando el negocio la declaró. Una hora de
    # peluquería no tiene aforo, y exigirle uno obligaría a inventar un número.
    if recurso.capacidad and personas > recurso.capacidad:
        raise ErrorDeReserva(
            f"{recurso.nombre} admite {recurso.capacidad} personas y se piden {personas}."
        )


@transaction.atomic
def crear(
    tenant,
    *,
    recurso,
    inicio,
    fin=None,
    personas=1,
    nombre_contacto="",
    telefono_contacto="",
    cliente=None,
    nota="",
    origen=Reserva.Origen.PANEL,
    usuario=None,
    estado=Reserva.Estado.PENDIENTE,
) -> Reserva:
    """
    Aparta el hueco, o dice que no queda.

    `fin` es opcional: si no viene, lo pone la duración del negocio. Es lo que
    permite que el mostrador reserve con dos datos —quién y a qué hora— sin
    preguntarle a nadie cuánto piensa quedarse.
    """
    config = configuracion(tenant)
    fin = fin or (inicio + config.duracion)

    # Bloquea el recurso HASTA EL COMMIT. Todo lo que va después —comprobar y
    # escribir— pasa con la mesa en la mano; sin esto, dos peticiones ven el
    # mismo hueco libre y las dos lo ocupan.
    recurso = Recurso.all_tenants.select_for_update().get(pk=recurso.pk)

    _validar_hueco(config, recurso, inicio, fin, personas)

    if not hay_sitio(recurso, inicio, fin):
        raise RecursoOcupado(
            f"{recurso.nombre} ya está ocupada a esa hora."
        )

    # El nombre se COPIA del cliente cuando no lo dan a mano. Copiado, no
    # referenciado: dentro de un año esta reserva tiene que seguir diciendo a
    # quién se esperaba aunque el cliente ya no exista.
    if not nombre_contacto and cliente is not None:
        nombre_contacto = getattr(cliente, "nombre", "") or str(cliente)
    if not telefono_contacto and cliente is not None:
        telefono_contacto = getattr(cliente, "telefono", "") or ""

    if not nombre_contacto:
        raise ErrorDeReserva("Una reserva necesita un nombre a quien esperar.")

    return Reserva.all_tenants.create(
        tenant_id=recurso.tenant_id,
        recurso=recurso,
        cliente=cliente,
        nombre_contacto=nombre_contacto[:120],
        telefono_contacto=(telefono_contacto or "")[:40],
        personas=personas or 1,
        inicio=inicio,
        fin=fin,
        estado=estado,
        origen=origen,
        nota=nota,
        creada_por=usuario,
    )


@transaction.atomic
def reprogramar(reserva, *, inicio=None, fin=None, recurso=None, personas=None) -> Reserva:
    """
    Cambia la hora, la mesa o el número de personas.

    Se llama reprogramar y no `editar` a propósito: mover una reserva vuelve a
    disputar un hueco, así que pasa por el mismo bloqueo y la misma
    comprobación que crearla. Un `PATCH` que se saltara esto dejaría dos
    reservas encimadas sin que nadie hubiera creado ninguna de más.
    """
    if not reserva.ocupa:
        raise CambioNoPermitido(
            f"La reserva está {reserva.get_estado_display().lower()}; ya no se mueve."
        )

    config = configuracion(reserva.tenant_id)
    destino = recurso or reserva.recurso
    destino = Recurso.all_tenants.select_for_update().get(pk=destino.pk)

    nuevo_inicio = inicio or reserva.inicio
    nuevo_fin = fin or (
        nuevo_inicio + config.duracion if inicio else reserva.fin
    )
    nuevas_personas = personas or reserva.personas

    _validar_hueco(config, destino, nuevo_inicio, nuevo_fin, nuevas_personas)

    # Se excluye a sí misma: si no, mover una reserva quince minutos chocaría
    # siempre contra su propio hueco anterior.
    if not hay_sitio(destino, nuevo_inicio, nuevo_fin, excluir=reserva.pk):
        raise RecursoOcupado(f"{destino.nombre} ya está ocupada a esa hora.")

    reserva.recurso = destino
    reserva.inicio = nuevo_inicio
    reserva.fin = nuevo_fin
    reserva.personas = nuevas_personas
    reserva.save(update_fields=["recurso", "inicio", "fin", "personas"])
    return reserva


# ==========================================================================
# ESTADOS
# ==========================================================================
def cambiar_estado(reserva, estado, *, nota=None) -> Reserva:
    """
    Avanza la reserva por su tabla de transiciones.

    No hay un método por estado —`confirmar()`, `cancelar()`, `sentar()`—
    porque serían seis funciones idénticas alrededor de la misma tabla, y la
    séptima se olvidaría de consultarla.
    """
    if estado == reserva.estado:
        return reserva

    permitidos = TRANSICIONES.get(reserva.estado, ())
    if estado not in permitidos:
        raise CambioNoPermitido(
            f"Una reserva {reserva.get_estado_display().lower()} no puede pasar a "
            f"«{Reserva.Estado(estado).label.lower()}»."
        )

    reserva.estado = estado
    campos = ["estado"]
    if nota is not None:
        reserva.nota = nota
        campos.append("nota")
    reserva.save(update_fields=campos)
    return reserva


@transaction.atomic
def enlazar_venta(reserva, venta) -> Reserva:
    """
    Cuelga la venta del mostrador de la reserva que la originó.

    La clave foránea va en esta dirección —de reserva a venta— y esa asimetría
    es la que sostiene toda la fase: el POS puede seguir sin saber que las
    reservas existen. Lo que él guarda es un diccionario opaco en
    `Venta.contexto`, y quien lo interpreta es este módulo.
    """
    if reserva.venta_id and reserva.venta_id != venta.pk:
        raise ErrorDeReserva("Esta reserva ya está enlazada a otra venta.")

    reserva.venta = venta
    campos = ["venta"]
    if reserva.estado in (Reserva.Estado.PENDIENTE, Reserva.Estado.CONFIRMADA):
        reserva.estado = Reserva.Estado.EN_CURSO
        campos.append("estado")
    reserva.save(update_fields=campos)
    return reserva
