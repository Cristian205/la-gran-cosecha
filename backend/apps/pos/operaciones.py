"""
Lo que hace la caja: abrir, cobrar, anular y cerrar.

Cuatro operaciones, y en las cuatro la misma regla: el POS NO toca existencias
a mano. Llama a `inventory.operaciones`, que es el único escritor del libro
mayor. Si algún día alguien escribe aquí un `Existencia.objects.update(...)`,
el saldo empezará a derivar del histórico y nadie se enterará hasta el conteo
de fin de mes.
"""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max, Sum
from django.utils import timezone

from apps.inventory import operaciones as inventario

from .models import LineaVenta, MedioPago, Pago, Turno, Venta

CERO = Decimal("0")

#: El origen con que se firman los movimientos de inventario del POS. El kardex
#: lo muestra tal cual, y es lo que permite responder «¿por qué salieron tres?».
ORIGEN = "pos.Venta"

#: Con qué medios de pago nace un negocio. Los tres que todo mostrador tiene;
#: el resto —Nequi, Daviplata, datáfono de tal banco— los da de alta cada
#: negocio, que es justo por lo que `MedioPago` es una tabla y no un enum.
MEDIOS_INICIALES = [
    {"codigo": "efectivo", "nombre": "Efectivo", "tipo": "EFECTIVO", "orden": 10},
    {"codigo": "tarjeta", "nombre": "Tarjeta", "tipo": "TARJETA", "orden": 20},
    {"codigo": "transferencia", "nombre": "Transferencia", "tipo": "TRANSFERENCIA", "orden": 30},
]


class ErrorDeCaja(Exception):
    """Base de los fallos que esta capa sabe explicarle a un cajero."""


class TurnoCerrado(ErrorDeCaja):
    """Se intentó operar sobre una caja que ya no está abierta."""


class VentaNoModificable(ErrorDeCaja):
    """La venta ya se cobró o se anuló; sus líneas no se tocan."""


class PagoIncompleto(ErrorDeCaja):
    """Se intentó cerrar una venta sin cubrir su total."""


# ==========================================================================
# MEDIOS DE PAGO
# ==========================================================================
def asegurar_medios_pago(tenant) -> list:
    """
    Deja al negocio con sus medios de pago básicos.

    Se llama al abrir el primer turno y no al activar el módulo, por una razón
    práctica: un negocio puede tener el POS contratado meses antes de estrenarlo,
    y lo que no puede es que la primera venta falle porque nadie dio de alta
    «Efectivo».
    """
    existentes = set(
        MedioPago.all_tenants.filter(tenant=tenant).values_list("codigo", flat=True)
    )
    creados = []
    for datos in MEDIOS_INICIALES:
        if datos["codigo"] in existentes:
            continue
        creados.append(MedioPago.all_tenants.create(tenant=tenant, **datos))
    return creados


# ==========================================================================
# TURNO
# ==========================================================================
@transaction.atomic
def abrir_turno(tenant, usuario, *, ubicacion=None, fondo_inicial=CERO) -> Turno:
    """
    Abre la caja. Como mucho una por ubicación a la vez.

    La restricción la garantiza la base con un índice único parcial; aquí se
    comprueba antes solo para dar un mensaje que se entienda en vez de un error
    de integridad.
    """
    if ubicacion is None:
        ubicacion = inventario.ubicacion_por_defecto(tenant)

    abierto = Turno.all_tenants.filter(
        tenant=tenant, ubicacion=ubicacion, fecha_cierre__isnull=True
    ).first()
    if abierto is not None:
        raise ErrorDeCaja(
            f"Ya hay un turno abierto en {ubicacion}, desde el "
            f"{abierto.fecha_apertura:%d/%m a las %H:%M}. Ciérralo antes de abrir otro."
        )

    asegurar_medios_pago(tenant)
    return Turno.all_tenants.create(
        tenant=tenant,
        ubicacion=ubicacion,
        usuario_apertura=usuario,
        fondo_inicial=Decimal(str(fondo_inicial or 0)),
    )


def turno_abierto(tenant, ubicacion=None):
    """El turno en curso, o None. Es lo primero que pregunta la pantalla."""
    filtros = {"tenant": tenant, "fecha_cierre__isnull": True}
    if ubicacion is not None:
        filtros["ubicacion"] = ubicacion
    return Turno.all_tenants.filter(**filtros).select_related("ubicacion").first()


def efectivo_esperado(turno) -> Decimal:
    """
    Cuánto debería haber en el cajón: el fondo más lo cobrado en efectivo.

    Solo cuenta lo que `MedioPago.cuenta_en_caja` marca. Lo cobrado con tarjeta
    llega al banco, no al cajón, y sumarlo haría que el arqueo no cuadrara
    nunca — que es la forma más rápida de que la gente deje de hacerlo.
    """
    cobrado = (
        Pago.all_tenants.filter(
            tenant=turno.tenant_id,
            venta__turno=turno,
            venta__estado=Venta.Estado.PAGADA,
            medio__tipo__in=MedioPago.TIPOS_EN_CAJA,
        ).aggregate(total=Sum("importe"))["total"]
        or CERO
    )
    return turno.fondo_inicial + cobrado


@transaction.atomic
def cerrar_turno(turno, usuario, *, total_declarado, nota="") -> Turno:
    """
    Cierra la caja y deja constancia de si cuadró.

    Se guardan los tres números —lo contado, lo esperado y la diferencia— en vez
    de solo el bueno. Un sistema que solo guarda el número correcto no sirve
    para descubrir nada al día siguiente.
    """
    if not turno.esta_abierto:
        raise TurnoCerrado("Este turno ya estaba cerrado.")

    abiertas = Venta.all_tenants.filter(
        tenant=turno.tenant_id, turno=turno, estado=Venta.Estado.ABIERTA
    ).count()
    if abiertas:
        raise ErrorDeCaja(
            f"Quedan {abiertas} venta(s) sin cobrar. Cóbralas o anúlalas antes de cerrar."
        )

    declarado = Decimal(str(total_declarado))
    esperado = efectivo_esperado(turno)

    turno.usuario_cierre = usuario
    turno.fecha_cierre = timezone.now()
    turno.total_declarado = declarado
    turno.total_calculado = esperado
    turno.diferencia = declarado - esperado
    turno.nota_cierre = nota
    turno.save(
        update_fields=[
            "usuario_cierre",
            "fecha_cierre",
            "total_declarado",
            "total_calculado",
            "diferencia",
            "nota_cierre",
        ]
    )
    return turno


# ==========================================================================
# VENTA
# ==========================================================================
@transaction.atomic
def abrir_venta(turno, usuario, *, cliente=None, contexto=None) -> Venta:
    """
    Empieza una venta en el turno abierto.

    El número se saca bloqueando la fila del TURNO, no la del negocio. Es la
    granularidad natural del contador: dos mostradores del mismo local no se
    estorban, y el consecutivo dentro de una caja no se salta. Es el mismo
    criterio con que `Producto` bloquea su categoría para numerarse.
    """
    if not turno.esta_abierto:
        raise TurnoCerrado("La caja está cerrada. Abre un turno para vender.")

    # Bloquea el contador de esta caja hasta el commit.
    Turno.all_tenants.select_for_update().get(pk=turno.pk)
    ultimo = Venta.all_tenants.filter(tenant=turno.tenant_id, turno=turno).aggregate(
        maximo=Max("numero")
    )["maximo"]

    try:
        return Venta.all_tenants.create(
            tenant_id=turno.tenant_id,
            turno=turno,
            numero=(ultimo or 0) + 1,
            usuario=usuario,
            cliente=cliente,
            contexto=dict(contexto or {}),
        )
    except IntegrityError as error:  # pragma: no cover — el bloqueo lo evita
        raise ErrorDeCaja("Dos ventas tomaron el mismo número. Vuelve a intentarlo.") from error


def _exigir_editable(venta):
    if venta.estado != Venta.Estado.ABIERTA:
        raise VentaNoModificable(
            f"La venta ya está {venta.get_estado_display().lower()}; sus líneas no se pueden cambiar."
        )


@transaction.atomic
def agregar_linea(venta, presentacion, cantidad, *, nota="", atributos=None) -> LineaVenta:
    """
    Añade un renglón. No mueve inventario todavía.

    El descuento ocurre al COBRAR y no al añadir, y la diferencia importa: una
    venta abierta puede quedarse a medias —el cliente se arrepiente, se va sin
    pagar— y descontar por adelantado dejaría el stock mintiendo hasta que
    alguien anulara la venta a mano.
    """
    _exigir_editable(venta)

    linea = LineaVenta.all_tenants.create(
        tenant_id=venta.tenant_id,
        venta=venta,
        presentacion=presentacion,
        cantidad=Decimal(str(cantidad)),
        precio_unitario=presentacion.precio_unitario,
        # Copiado, no referenciado: si mañana cambian los ejes de atributos del
        # negocio, esta venta tiene que seguir diciendo lo que se vendió.
        atributos=dict(atributos or presentacion.atributos or {}),
        nota=nota,
    )
    recalcular(venta)
    return linea


@transaction.atomic
def quitar_linea(linea) -> Venta:
    venta = linea.venta
    _exigir_editable(venta)
    linea.delete()
    recalcular(venta)
    return venta


def recalcular(venta) -> Venta:
    """Suma las líneas y guarda el total. El descuento se aplica al final."""
    subtotal = (
        LineaVenta.all_tenants.filter(tenant=venta.tenant_id, venta=venta).aggregate(
            total=Sum("subtotal")
        )["total"]
        or CERO
    )
    venta.subtotal = subtotal
    venta.total = max(subtotal - (venta.descuento or CERO), CERO)
    venta.save(update_fields=["subtotal", "total"])
    return venta


@transaction.atomic
def cobrar(venta, pagos, *, usuario=None) -> Venta:
    """
    Cierra la venta: registra los pagos y descuenta el inventario.

    `pagos` es `[(medio, importe, referencia)]`. Se admite más de uno porque el
    pago partido —mitad efectivo, mitad tarjeta— es la norma y no la excepción.

    Las dos cosas ocurren en la MISMA transacción que el descuento de stock. Si
    el inventario se niega —no hay bastante y el negocio no permite negativo—,
    la venta entera se deshace: cobrar algo que no se puede entregar es peor
    que no cobrarlo.
    """
    _exigir_editable(venta)

    if not LineaVenta.all_tenants.filter(tenant=venta.tenant_id, venta=venta).exists():
        raise ErrorDeCaja("La venta no tiene productos.")

    recalcular(venta)

    total_pagado = sum((Decimal(str(importe)) for _, importe, *_ in pagos), CERO)
    if total_pagado < venta.total:
        raise PagoIncompleto(
            f"Faltan {venta.total - total_pagado} por cubrir. "
            f"El total es {venta.total} y se registraron {total_pagado}."
        )

    for medio, importe, *resto in pagos:
        Pago.all_tenants.create(
            tenant_id=venta.tenant_id,
            venta=venta,
            medio=medio,
            importe=Decimal(str(importe)),
            referencia=(resto[0] if resto else "") or "",
        )

    _mover_inventario(venta, sentido=-1, usuario=usuario, motivo=f"Venta {venta}")

    venta.estado = Venta.Estado.PAGADA
    venta.fecha_pago = timezone.now()
    venta.save(update_fields=["estado", "fecha_pago"])
    return venta


@transaction.atomic
def anular(venta, usuario, *, motivo="") -> Venta:
    """
    Anula una venta y devuelve la mercancía al inventario.

    La venta NO se borra: se marca. Un histórico del que desaparecen las ventas
    equivocadas no sirve para cuadrar nada, y además el turno dejaría de
    explicar el dinero que se movió. Es el mismo criterio que el kardex, que
    corrige con un ajuste en vez de reescribir.
    """
    if venta.estado == Venta.Estado.ANULADA:
        raise VentaNoModificable("Esta venta ya estaba anulada.")

    if venta.estado == Venta.Estado.PAGADA:
        _mover_inventario(
            venta, sentido=1, usuario=usuario, motivo=f"Anulación de {venta}"
        )

    venta.estado = Venta.Estado.ANULADA
    venta.anulada_por = usuario
    venta.motivo_anulacion = motivo
    venta.save(update_fields=["estado", "anulada_por", "motivo_anulacion"])
    return venta


def _mover_inventario(venta, *, sentido, usuario, motivo):
    """
    Descuenta (sentido -1) o devuelve (sentido +1) lo que la venta contiene.

    Solo se mueven los productos que llevan inventario. Los demás se saltan sin
    ruido: son la mayoría del catálogo de un negocio que todavía no ha contado
    lo que tiene, y negarse a venderlos sería absurdo.
    """
    lineas = (
        LineaVenta.all_tenants.filter(tenant=venta.tenant_id, venta=venta)
        .select_related("presentacion__producto")
    )
    for linea in lineas:
        producto = linea.presentacion.producto
        if not producto.controla_stock:
            continue

        cantidad = inventario.a_unidad_base(linea.presentacion, linea.cantidad)
        operacion = inventario.entrada if sentido > 0 else inventario.salida
        operacion(
            producto,
            cantidad,
            ubicacion=venta.turno.ubicacion,
            presentacion=linea.presentacion,
            origen_tipo=ORIGEN,
            origen_id=venta.pk,
            usuario=usuario,
            motivo=motivo,
        )
