"""
El único escritor de existencias de toda la plataforma.

Aquí está la respuesta a «cómo se sincronizan el POS, el inventario y la
tienda»: no se sincronizan. No son tres almacenes de datos que haya que
conciliar, son tres escritores del mismo libro mayor. El POS descuenta, la
tienda reserva y las compras suman, todos por esta puerta y dentro de la misma
transacción de quien llama. No hay cola, ni webhook, ni tarea de fondo, ni una
ventana de segundos en la que dos pantallas digan cosas distintas.

Que esto se sostenga depende de una regla que no admite excepciones:

    NINGÚN `UPDATE` a `Existencia` fuera de este módulo.

En cuanto una segunda función toque esas columnas, el bloqueo de fila deja de
cubrir el concurso y la caché empieza a derivar del histórico sin que nadie se
entere hasta el conteo de fin de mes.

# Sobre el bloqueo

`select_for_update()` es la línea que impide que dos cajeros vendan la misma
última unidad. Sin ella el patrón «lee el saldo, comprueba, escribe» tiene una
ventana entre la lectura y la escritura en la que el otro cajero ya ha vendido,
y el resultado es una venta que no se puede entregar. No se detecta en
desarrollo, donde nunca hay dos peticiones a la vez: aparece un sábado con dos
cajas abiertas.

Como la fila queda bloqueada hasta el commit, el saldo se calcula en Python en
vez de con `F()`. Con el bloqueo tomado son equivalentes, y en Python el valor
resultante se puede comprobar y devolver — con `F()` habría que releerlo.
"""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum

from .models import Existencia, MovimientoInventario, Ubicacion

CERO = Decimal("0")


class ErrorDeInventario(Exception):
    """Base de los fallos que esta capa sabe explicar."""


class StockInsuficiente(ErrorDeInventario):
    """
    No hay bastante para lo que se pide.

    Se lanza ANTES de escribir nada, así que la caja lo ve antes de cobrar y el
    pedido antes de confirmarse. Que llegue como excepción y no como un valor de
    retorno es deliberado: un saldo insuficiente ignorado por descuido es una
    venta que no se puede entregar.
    """


class SinUbicacion(ErrorDeInventario):
    """El negocio no tiene ninguna ubicación donde guardar existencias."""


# ==========================================================================
# CONVERSIÓN DE UNIDADES
# ==========================================================================
def a_unidad_base(presentacion, cantidad) -> Decimal:
    """
    Cuántas unidades base salen de vender `cantidad` de esta presentación.

    Tres cajas de doce son treinta y seis unidades. Es la conversión que hace
    que el saldo sea uno solo por producto y no uno por forma de empaquetarlo;
    ver el grano en `models.Existencia`.
    """
    factor = getattr(presentacion, "factor_conversion", None) or Decimal("1")
    return Decimal(str(cantidad)) * Decimal(str(factor))


# ==========================================================================
# UBICACIÓN POR DEFECTO
# ==========================================================================
def ubicacion_por_defecto(tenant, *, crear=True) -> Ubicacion:
    """
    La ubicación a la que van los movimientos que no eligen una.

    Con `crear` la fabrica si el negocio no tiene ninguna, que es el caso de
    todos los negocios existentes el día que esta app entra en servicio. La
    alternativa —obligar a crearla a mano antes del primer movimiento— haría
    que la primera venta tras el despliegue fallara en producción.
    """
    # `all_tenants` con filtro explícito: esto se llama desde señales y comandos,
    # donde no hay contexto de petición declarado.
    encontrada = (
        Ubicacion.all_tenants.filter(tenant=tenant, activa=True)
        .order_by("-es_predeterminada", "id")
        .first()
    )
    if encontrada is not None:
        return encontrada
    if not crear:
        raise SinUbicacion(f"El negocio «{tenant}» no tiene ninguna ubicación activa.")

    return Ubicacion.all_tenants.create(
        tenant=tenant,
        nombre="Principal",
        codigo="principal",
        tipo=Ubicacion.Tipo.TIENDA,
        es_predeterminada=True,
    )


# ==========================================================================
# LA PRIMITIVA
# ==========================================================================
@transaction.atomic
def mover(
    *,
    producto,
    cantidad_base,
    tipo,
    ubicacion=None,
    presentacion=None,
    origen_tipo="",
    origen_id=None,
    usuario=None,
    motivo="",
    permitir_negativo=None,
):
    """
    Aplica un movimiento y devuelve la `Existencia` ya actualizada.

    `cantidad_base` va CON SIGNO y en unidad base: una salida es negativa. Se
    escribe así en la llamada, y no con un booleano de sentido, porque el signo
    viaja tal cual al histórico y ahí la suma de la columna tiene que dar el
    saldo. Un tipo y un signo que no concuerdan es un error de programación, y
    se rechaza en vez de corregirse en silencio.

    Los tipos RESERVA y LIBERACION mueven `reservada`; todos los demás mueven
    `cantidad`. Es la única ramificación de este módulo.
    """
    cantidad_base = Decimal(str(cantidad_base))
    if cantidad_base == CERO:
        raise ValueError("Un movimiento de cero no dice nada; no se registra.")

    tenant_id = producto.tenant_id
    if ubicacion is None:
        ubicacion = ubicacion_por_defecto(producto.tenant)

    if permitir_negativo is None:
        # Sin orden expresa manda el perfil del negocio. Una ferretería prefiere
        # vender y cuadrar después; una farmacia no puede. Es una decisión de
        # negocio, y por eso vive en el perfil y no en una constante de aquí.
        from apps.business.consulta import politica_stock  # noqa: PLC0415

        permitir_negativo = politica_stock(producto.tenant)["permite_negativo"]

    if ubicacion.tenant_id != tenant_id:
        # Sin esta comprobación, un id de ubicación de otro negocio movería
        # mercancía entre empresas. El manager no lo ve: ambos objetos llegan
        # ya construidos.
        raise ErrorDeInventario("La ubicación no pertenece al negocio del producto.")

    existencia = _bloquear(tenant_id, producto, ubicacion)
    es_reserva = tipo in MovimientoInventario.TIPOS_DE_RESERVA

    if es_reserva:
        nueva_reservada = existencia.reservada + cantidad_base
        if nueva_reservada < CERO:
            # Liberar más de lo reservado dejaría `reservada` negativa y con
            # ella el disponible por encima de lo que hay físicamente.
            raise StockInsuficiente(
                f"Se intentó liberar {-cantidad_base} de «{producto}» y solo hay "
                f"{existencia.reservada} reservadas."
            )
        if cantidad_base > CERO and not permitir_negativo:
            _exigir_disponible(existencia, cantidad_base, producto)
        existencia.reservada = nueva_reservada
        saldo = existencia.cantidad
    else:
        nueva_cantidad = existencia.cantidad + cantidad_base
        if nueva_cantidad < CERO and not permitir_negativo:
            raise StockInsuficiente(
                f"No hay suficiente «{producto}» en {ubicacion}: quedan "
                f"{existencia.cantidad} y se intentó sacar {-cantidad_base}."
            )
        existencia.cantidad = nueva_cantidad
        saldo = nueva_cantidad

    existencia.save(update_fields=["cantidad", "reservada", "fecha_actualizacion"])

    MovimientoInventario.all_tenants.create(
        tenant_id=tenant_id,
        producto=producto,
        ubicacion=ubicacion,
        presentacion=presentacion,
        tipo=tipo,
        cantidad=cantidad_base,
        saldo_resultante=saldo,
        origen_tipo=origen_tipo,
        origen_id=origen_id,
        usuario=usuario,
        motivo=motivo,
    )
    return existencia


def _bloquear(tenant_id, producto, ubicacion) -> Existencia:
    """
    La fila del saldo, bloqueada hasta el commit.

    No es `get_or_create(select_for_update=...)` porque en el camino de creación
    no hay fila que bloquear: dos primeras ventas simultáneas del mismo producto
    chocarían contra el índice único. Se atrapa esa colisión y se relee, que es
    lo correcto —la otra transacción ya creó la fila que necesitamos— en vez de
    devolverle el error a un cajero.
    """
    base = Existencia.all_tenants.filter(
        tenant=tenant_id, producto=producto, ubicacion=ubicacion
    )
    existencia = base.select_for_update().first()
    if existencia is not None:
        return existencia

    try:
        with transaction.atomic():
            return Existencia.all_tenants.create(
                tenant_id=tenant_id, producto=producto, ubicacion=ubicacion
            )
    except IntegrityError:
        return base.select_for_update().get()


def _exigir_disponible(existencia, cantidad, producto):
    if existencia.disponible < cantidad:
        raise StockInsuficiente(
            f"Solo hay {existencia.disponible} disponibles de «{producto}» "
            f"({existencia.cantidad} en total, {existencia.reservada} ya reservadas)."
        )


# ==========================================================================
# LAS OPERACIONES QUE USA EL RESTO DE LA PLATAFORMA
# ==========================================================================
def entrada(producto, cantidad_base, **kwargs):
    """Llega mercancía: una compra, una devolución, el inventario inicial."""
    return mover(
        producto=producto,
        cantidad_base=abs(Decimal(str(cantidad_base))),
        tipo=MovimientoInventario.Tipo.ENTRADA,
        **kwargs,
    )


def salida(producto, cantidad_base, **kwargs):
    """
    Sale mercancía por la puerta. Es lo que hace el POS al cobrar.

    El POS descuenta en el acto y no reserva porque en el mostrador no hay
    ventana entre confirmar y entregar: la bolsa se la lleva el cliente.
    """
    return mover(
        producto=producto,
        cantidad_base=-abs(Decimal(str(cantidad_base))),
        tipo=MovimientoInventario.Tipo.SALIDA,
        **kwargs,
    )


def reservar(producto, cantidad_base, **kwargs):
    """
    Aparta mercancía para un pedido confirmado que aún no se ha entregado.

    Es el ritmo de la tienda online, distinto del POS a propósito: entre que el
    cliente confirma y el repartidor sale pueden pasar horas, y durante esas
    horas la mercancía ni está vendida ni se puede volver a prometer.
    """
    return mover(
        producto=producto,
        cantidad_base=abs(Decimal(str(cantidad_base))),
        tipo=MovimientoInventario.Tipo.RESERVA,
        **kwargs,
    )


def liberar(producto, cantidad_base, **kwargs):
    """Se cancela el pedido: lo apartado vuelve a estar a la venta."""
    return mover(
        producto=producto,
        cantidad_base=-abs(Decimal(str(cantidad_base))),
        tipo=MovimientoInventario.Tipo.LIBERACION,
        **kwargs,
    )


@transaction.atomic
def despachar(producto, cantidad_base, **kwargs):
    """
    Se entrega lo reservado: deja de estar apartado y sale de verdad.

    Son dos movimientos y no uno porque el histórico tiene que poder contar las
    dos cosas por separado — cuándo se apartó y cuándo salió—, que es
    exactamente lo que se pregunta cuando un cliente reclama un pedido.
    """
    cantidad = abs(Decimal(str(cantidad_base)))
    liberar(producto, cantidad, **kwargs)
    # `permitir_negativo` aquí: lo reservado ya se comprobó al apartarlo, y
    # negarse a entregar mercancía que el cliente tiene delante por un
    # descuadre del saldo no ayuda a nadie. El descuadre se ve en el kardex.
    kwargs.setdefault("permitir_negativo", True)
    return salida(producto, cantidad, **kwargs)


def ajustar(producto, cantidad_contada, *, ubicacion=None, **kwargs):
    """
    Cuadra el saldo con lo que dice el conteo físico.

    Recibe el TOTAL contado, no la diferencia, porque es lo que la persona tiene
    delante al contar. La diferencia la calcula esta función, que es la que
    sabe cuál era el saldo anterior.
    """
    tenant = producto.tenant
    if ubicacion is None:
        ubicacion = ubicacion_por_defecto(tenant)

    actual = Existencia.all_tenants.filter(
        tenant=tenant, producto=producto, ubicacion=ubicacion
    ).first()
    anterior = actual.cantidad if actual else CERO
    diferencia = Decimal(str(cantidad_contada)) - anterior
    if diferencia == CERO:
        return actual

    kwargs.setdefault("motivo", "Ajuste por conteo físico")
    return mover(
        producto=producto,
        cantidad_base=diferencia,
        tipo=MovimientoInventario.Tipo.AJUSTE,
        ubicacion=ubicacion,
        permitir_negativo=True,  # el conteo manda sobre el saldo, siempre
        **kwargs,
    )


@transaction.atomic
def trasladar(producto, cantidad_base, *, origen, destino, **kwargs):
    """Mueve mercancía entre dos ubicaciones del mismo negocio."""
    if origen.pk == destino.pk:
        raise ErrorDeInventario("El origen y el destino son la misma ubicación.")
    cantidad = abs(Decimal(str(cantidad_base)))
    tipo = MovimientoInventario.Tipo.TRASLADO
    mover(producto=producto, cantidad_base=-cantidad, tipo=tipo, ubicacion=origen, **kwargs)
    return mover(
        producto=producto, cantidad_base=cantidad, tipo=tipo, ubicacion=destino, **kwargs
    )


# ==========================================================================
# CONSULTA Y COMPROBACIÓN
# ==========================================================================
def disponible(producto, ubicacion=None) -> Decimal:
    """
    Lo que se puede vender ahora mismo, en unidad base.

    Sin `ubicacion` suma todas las del negocio, que es lo que la tienda online
    quiere saber: al visitante no le importa de qué bodega sale.
    """
    filtros = {"tenant": producto.tenant_id, "producto": producto}
    if ubicacion is not None:
        filtros["ubicacion"] = ubicacion

    totales = Existencia.all_tenants.filter(**filtros).aggregate(
        hay=Sum("cantidad"), apartado=Sum("reservada")
    )
    return (totales["hay"] or CERO) - (totales["apartado"] or CERO)


def recalcular(producto, ubicacion) -> Decimal:
    """
    Suma el histórico y devuelve lo que el saldo DEBERÍA ser.

    No corrige nada: es la comprobación de que la caché no ha derivado. Si esto
    y `Existencia.cantidad` dejan de coincidir, hay un escritor fuera de este
    módulo y el problema es ese, no el número. Lo usa el test que defiende la
    regla del único escritor.
    """
    suma = (
        MovimientoInventario.all_tenants.filter(
            tenant=producto.tenant_id, producto=producto, ubicacion=ubicacion
        )
        .exclude(tipo__in=MovimientoInventario.TIPOS_DE_RESERVA)
        .aggregate(total=Sum("cantidad"))["total"]
    )
    return suma or CERO


def anotacion_disponible():
    """
    Expresión para anotar el disponible de cada producto en un `QuerySet`.

    Va como subconsulta correlacionada y NO como `Sum("existencias__cantidad")`
    por una razón concreta: el queryset del catálogo ya se une a las
    presentaciones para calcular `precio_desde`, y dos uniones a-muchos en la
    misma consulta multiplican las filas entre sí. Un `Min` sobrevive a esa
    duplicación; un `Sum` no —devolvería el stock multiplicado por el número de
    presentaciones del producto—. Es de los errores que dan un número plausible,
    que es lo que los hace difíciles de ver.

        Producto.objects.annotate(disponible=anotacion_disponible())
    """
    from django.db.models import DecimalField, F, OuterRef, Subquery, Value
    from django.db.models.functions import Coalesce

    saldo = (
        Existencia.objects.filter(producto=OuterRef("pk"))
        .values("producto")
        .annotate(neto=Sum(F("cantidad") - F("reservada")))
        .values("neto")[:1]
    )
    campo = DecimalField(max_digits=14, decimal_places=3)
    # Coalesce: un producto sin ninguna fila de existencia no tiene stock cero,
    # tiene stock desconocido. Para la tienda son lo mismo —no se puede
    # prometer— y devolver NULL obligaría a defenderse en cada pantalla.
    return Coalesce(Subquery(saldo, output_field=campo), Value(0), output_field=campo)
