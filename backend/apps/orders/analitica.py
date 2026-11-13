"""
Analítica comercial del dashboard: los cálculos, separados de las vistas.

Cada función recibe un `Periodo` y devuelve datos ya agregados en la base. El
panel nunca descarga pedidos para sumarlos: lo más grande que viaja es una fila
por día del período (≤ 366) o una por producto vendido.

# Definiciones (una sola vez, para todo el dashboard)

- **Venta**: un pedido ENTREGADO. Es la regla que ya usaban las estadísticas,
  el Excel y el ranking público; ningún otro estado cuenta como venta. Su fecha
  es `fecha_pedido` (cuándo se pidió), igual que en el resto del sistema.
- **Pedido realizado**: cualquier pedido creado en el período, en cualquiera
  de sus estados reales (PENDIENTE, EDITADO, CERRADO, IMPRESO, ENTREGADO).
- **Ticket promedio**: ventas ÷ pedidos entregados. Sin entregados no hay
  promedio (`None`), nunca una división por cero.
- **Cliente registrado**: existe en la base, haya comprado o no.
- **Nuevo por registro**: su `fecha_registro_cliente` cae en el período.
- **Comprador (activo)**: tiene al menos una venta en el período.
- **Nuevo por primera compra**: su primera venta HISTÓRICA cae en el período.
- **Recurrente**: comprador del período cuya primera venta es anterior al
  período. Comprador = nuevo por primera compra + recurrente, siempre.
- **Inactivo**: compró alguna vez, pero su última venta tiene más de
  `DIAS_INACTIVIDAD` días al cierre del período.
- **Período anterior**: el tramo de igual duración inmediatamente antes. Si el
  período llega hasta ahora mismo («hoy», «este mes»), el anterior se corta a
  la misma hora: las 10 de la mañana de hoy se comparan con las 10 de la
  mañana de ayer, no con el día completo.

Las fechas son locales (`TIME_ZONE`, America/Bogotá): «hoy» empieza a la
medianoche de Colombia, no de Greenwich.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.functions import Coalesce, TruncDay, TruncHour, TruncMonth, TruncWeek
from django.utils import timezone

from apps.catalog.models import PresentacionProducto, Producto

from .models import Cliente, DetallePedido, Pedido

ESTADO_VENTA = "ENTREGADO"
ESTADOS = tuple(e for e, _ in Pedido.ESTADOS)
#: Los estados en que un pedido todavía necesita que alguien haga algo.
ESTADOS_ABIERTOS = ("PENDIENTE", "EDITADO", "CERRADO", "IMPRESO")

DIAS_MAX = 366
#: Hasta cuántos días la serie va por día, y hasta cuántos por semana; por
#: encima, por mes (un año día a día son 366 puntos que nadie lee).
DIAS_MAX_DIARIA = 62
DIAS_MAX_SEMANAL = 120
DIAS_INACTIVIDAD = 60

LIMITE_PRODUCTOS = 20
LIMITE_RECIENTES = 50

TRUNC = {"hora": TruncHour, "dia": TruncDay, "semana": TruncWeek, "mes": TruncMonth}


# ==========================================================================
# EL PERÍODO
# ==========================================================================
@dataclass(frozen=True)
class Ventana:
    """[inicio, fin) en hora consciente de zona. `fin` es exclusivo."""

    inicio: datetime
    fin: datetime

    def filtro(self, campo: str = "fecha_pedido") -> Q:
        return Q(**{f"{campo}__gte": self.inicio, f"{campo}__lt": self.fin})


@dataclass(frozen=True)
class Periodo:
    desde: date
    hasta: date
    actual: Ventana
    anterior: Ventana | None
    granularidad: str
    #: Si el período llega hasta ahora y por eso termina antes de medianoche.
    recortado: bool

    @property
    def dias(self) -> int:
        return (self.hasta - self.desde).days + 1

    @property
    def desplazamiento(self) -> timedelta:
        return timedelta(days=self.dias)

    def como_dict(self) -> dict:
        anterior = None
        if self.anterior:
            ultimo = timezone.localtime(self.anterior.fin - timedelta(microseconds=1))
            anterior = {
                "desde": self.desde - self.desplazamiento,
                "hasta": ultimo.date(),
                # Hasta qué hora se compara cuando el período llega a ahora.
                "hasta_hora": timezone.localtime(self.anterior.fin).strftime("%H:%M") if self.recortado else None,
            }
        return {
            "desde": self.desde,
            "hasta": self.hasta,
            "dias": self.dias,
            "granularidad": self.granularidad,
            "anterior": anterior,
        }


def granularidad_para(dias: int) -> str:
    if dias == 1:
        return "hora"
    if dias <= DIAS_MAX_DIARIA:
        return "dia"
    if dias <= DIAS_MAX_SEMANAL:
        return "semana"
    return "mes"


def _medianoche(dia: date) -> datetime:
    return timezone.make_aware(datetime.combine(dia, time.min), timezone.get_current_timezone())


def construir_periodo(desde: date, hasta: date, comparar: bool = True, ahora: datetime | None = None) -> Periodo:
    ahora = ahora or timezone.now()
    inicio = _medianoche(desde)
    fin = _medianoche(hasta + timedelta(days=1))
    recortado = inicio < ahora < fin
    fin_efectivo = ahora if recortado else fin

    anterior = None
    if comparar:
        dias = (hasta - desde).days + 1
        inicio_ant = _medianoche(desde - timedelta(days=dias))
        anterior = Ventana(inicio_ant, inicio_ant + (fin_efectivo - inicio))

    return Periodo(
        desde=desde,
        hasta=hasta,
        actual=Ventana(inicio, fin_efectivo),
        anterior=anterior,
        granularidad=granularidad_para((hasta - desde).days + 1),
        recortado=recortado,
    )


# ==========================================================================
# CUBETAS DE LA SERIE
# ==========================================================================
def inicio_de_cubeta(momento: datetime, granularidad: str) -> datetime:
    """Inicio (local, sin zona) de la cubeta a la que pertenece `momento`."""
    if granularidad == "hora":
        return momento.replace(minute=0, second=0, microsecond=0)
    dia = datetime.combine(momento.date(), time.min)
    if granularidad == "dia":
        return dia
    if granularidad == "semana":
        return dia - timedelta(days=dia.weekday())
    return dia.replace(day=1)


def cubetas(periodo: Periodo) -> list[datetime]:
    """Todas las cubetas del período, también las vacías: un día sin ventas es información."""
    g = periodo.granularidad
    if g == "hora":
        base = datetime.combine(periodo.desde, time.min)
        return [base + timedelta(hours=h) for h in range(24)]
    paso = {"dia": relativedelta(days=1), "semana": relativedelta(weeks=1), "mes": relativedelta(months=1)}[g]
    actual = inicio_de_cubeta(datetime.combine(periodo.desde, time.min), g)
    ultimo = datetime.combine(periodo.hasta, time.min)
    salida = []
    while actual <= ultimo:
        salida.append(actual)
        actual += paso
    return salida


def etiqueta_iso(inicio: datetime, granularidad: str) -> str:
    return inicio.isoformat() if granularidad == "hora" else inicio.date().isoformat()


def _local(momento: datetime) -> datetime:
    return timezone.localtime(momento).replace(tzinfo=None)


def _ventas_en(ventana: Ventana):
    return Pedido.objects.filter(ventana.filtro(), estado=ESTADO_VENTA)


def _pedidos_en(ventana: Ventana):
    return Pedido.objects.filter(ventana.filtro())


def _por_unidad_minima(qs, granularidad: str) -> list[tuple[datetime, Decimal, int]]:
    """
    (momento local, total, pedidos) por hora (período de un día) o por día.

    La base agrega a este grano y Python reparte en semanas o meses. Así el
    período anterior cae en las MISMAS cubetas que el actual (se desplaza la
    fecha, no se vuelve a truncar), y nunca viajan más de 366 filas.
    """
    trunc = TruncHour if granularidad == "hora" else TruncDay
    return [
        (_local(fila["c"]), fila["total"] or Decimal("0"), fila["n"])
        for fila in qs.annotate(c=trunc("fecha_pedido"))
        .values("c")
        .annotate(total=Sum("total_pedido"), n=Count("id"))
    ]


def _ticket(total, pedidos) -> float | None:
    return round(float(total) / pedidos, 2) if pedidos else None


# ==========================================================================
# RESUMEN EJECUTIVO (los cuatro KPI)
# ==========================================================================
def _resumen_ventas(ventana: Ventana) -> tuple[float, int]:
    r = _ventas_en(ventana).aggregate(total=Sum("total_pedido"), n=Count("id"))
    return float(r["total"] or 0), r["n"]


def _compradores(ventana: Ventana) -> dict:
    activos = _ventas_en(ventana).exclude(cliente=None).values("cliente").distinct().count()
    nuevos = _primeras_compras_en(ventana).count()
    return {"activos": activos, "nuevos": nuevos, "recurrentes": activos - nuevos}


def _primeras_compras_en(ventana: Ventana):
    return Cliente.objects.annotate(
        primera=Min("pedidos__fecha_pedido", filter=Q(pedidos__estado=ESTADO_VENTA))
    ).filter(primera__gte=ventana.inicio, primera__lt=ventana.fin)


def resumen(periodo: Periodo) -> dict:
    total, entregados = _resumen_ventas(periodo.actual)
    pedidos = _pedidos_en(periodo.actual)
    por_estado = {x["estado"]: x["n"] for x in pedidos.values("estado").annotate(n=Count("id"))}
    clientes = _compradores(periodo.actual)

    anterior = None
    if periodo.anterior:
        total_ant, entregados_ant = _resumen_ventas(periodo.anterior)
        anterior = {
            "ventas": total_ant,
            "pedidos": _pedidos_en(periodo.anterior).count(),
            "ticket": _ticket(total_ant, entregados_ant),
            "clientes_activos": _compradores(periodo.anterior)["activos"],
        }

    # Las minigráficas de las tarjetas: la misma serie que la gráfica grande,
    # más compradores y pedidos (de cualquier estado) por cubeta.
    serie = serie_ventas(periodo, con_anterior=False)
    trunc = TRUNC[periodo.granularidad]("fecha_pedido")
    compradores = {
        inicio_de_cubeta(_local(x["c"]), periodo.granularidad): x["n"]
        for x in _ventas_en(periodo.actual)
        .exclude(cliente=None)
        .annotate(c=trunc)
        .values("c")
        .annotate(n=Count("cliente", distinct=True))
    }
    recibidos = defaultdict(int)
    for momento, _total, n in _por_unidad_minima(pedidos, periodo.granularidad):
        recibidos[inicio_de_cubeta(momento, periodo.granularidad)] += n
    claves = cubetas(periodo)

    return {
        "ventas": {"total": total, "entregados": entregados, "serie": [p["ventas"] for p in serie]},
        "pedidos": {
            "total": sum(por_estado.values()),
            "por_estado": {e: por_estado.get(e, 0) for e in ESTADOS},
            "serie": [recibidos.get(c, 0) for c in claves],
        },
        "ticket": {"promedio": _ticket(total, entregados), "serie": [p["ticket"] for p in serie]},
        "clientes": {**clientes, "serie": [compradores.get(c, 0) for c in claves]},
        "anterior": anterior,
    }


# ==========================================================================
# EVOLUCIÓN DE VENTAS
# ==========================================================================
def serie_ventas(periodo: Periodo, con_anterior: bool = True) -> list[dict]:
    g = periodo.granularidad

    def acumular(filas, desplazar: timedelta = timedelta(0)):
        acc = defaultdict(lambda: [Decimal("0"), 0])
        for momento, total, n in filas:
            clave = inicio_de_cubeta(momento + desplazar, g)
            acc[clave][0] += total
            acc[clave][1] += n
        return acc

    actual = acumular(_por_unidad_minima(_ventas_en(periodo.actual), g))
    previo = None
    if con_anterior and periodo.anterior:
        previo = acumular(_por_unidad_minima(_ventas_en(periodo.anterior), g), periodo.desplazamiento)

    serie = []
    for inicio in cubetas(periodo):
        total, n = actual.get(inicio, (Decimal("0"), 0))
        punto = {
            "inicio": etiqueta_iso(inicio, g),
            "ventas": float(total),
            "pedidos": n,
            "ticket": _ticket(total, n),
        }
        if previo is not None:
            t_ant, n_ant = previo.get(inicio, (Decimal("0"), 0))
            punto["anterior"] = {"ventas": float(t_ant), "pedidos": n_ant, "ticket": _ticket(t_ant, n_ant)}
        serie.append(punto)
    return serie


DIAS_SEMANA = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


def analisis_ventas(periodo: Periodo) -> dict:
    serie = serie_ventas(periodo)
    total, entregados = _resumen_ventas(periodo.actual)

    # Los indicadores de abajo de la gráfica van siempre por DÍA, sea cual sea
    # el grano de la gráfica.
    por_dia = {m.date(): (t, n) for m, t, n in _por_unidad_minima(_ventas_en(periodo.actual), "dia")}
    dia_top = max(por_dia.items(), key=lambda kv: kv[1][0], default=None)

    # Días transcurridos: «este mes» a día 12 promedia entre 12, no entre 30.
    transcurridos = max(1, math.ceil((periodo.actual.fin - periodo.actual.inicio) / timedelta(days=1)))

    # El mejor día de la semana se mide por PROMEDIO: un período con cinco
    # lunes y cuatro martes no debe premiar al lunes por tener uno más.
    suma_semana, veces_semana = defaultdict(Decimal), Counter()
    for i in range(transcurridos):
        dia = periodo.desde + timedelta(days=i)
        veces_semana[dia.weekday()] += 1
        suma_semana[dia.weekday()] += por_dia.get(dia, (Decimal("0"), 0))[0]
    promedios = {d: suma_semana[d] / veces_semana[d] for d in veces_semana if suma_semana[d] > 0}
    mejor_semana = max(promedios.items(), key=lambda kv: kv[1], default=None)

    anterior = None
    if periodo.anterior:
        total_ant, entregados_ant = _resumen_ventas(periodo.anterior)
        anterior = {"ventas": total_ant, "pedidos": entregados_ant, "ticket": _ticket(total_ant, entregados_ant)}

    return {
        "serie": serie,
        "totales": {"ventas": total, "pedidos": entregados, "ticket": _ticket(total, entregados)},
        "anterior": anterior,
        "indicadores": {
            "promedio_diario": round(total / transcurridos, 2),
            "dias_transcurridos": transcurridos,
            "dia_mayor_facturacion": (
                {"fecha": dia_top[0], "ventas": float(dia_top[1][0]), "pedidos": dia_top[1][1]}
                if dia_top and dia_top[1][0] > 0
                else None
            ),
            "mejor_dia_semana": (
                {"dia": DIAS_SEMANA[mejor_semana[0]], "promedio": round(float(mejor_semana[1]), 2)}
                if mejor_semana
                else None
            ),
        },
    }


# ==========================================================================
# CLIENTES
# ==========================================================================
FRECUENCIAS = (("1", "1 compra", 1, 1), ("2", "2 compras", 2, 2), ("3-4", "3 a 4 compras", 3, 4), ("5+", "5 o más", 5, None))


def analitica_clientes(periodo: Periodo) -> dict:
    v = periodo.actual
    compradores = _compradores(v)
    registros = Cliente.objects.filter(v.filtro("fecha_registro_cliente"))

    referencia = v.fin - timedelta(days=DIAS_INACTIVIDAD)
    historico = Cliente.objects.annotate(
        ultima=Max("pedidos__fecha_pedido", filter=Q(pedidos__estado=ESTADO_VENTA))
    ).filter(ultima__isnull=False)

    # Evolución: cuántos clientes nuevos (por primera compra y por registro)
    # entraron en cada cubeta. Son tantas filas como clientes nuevos, no como
    # pedidos.
    g = periodo.granularidad
    por_compra = Counter(
        inicio_de_cubeta(_local(m), g) for m in _primeras_compras_en(v).values_list("primera", flat=True)
    )
    por_registro = Counter(
        inicio_de_cubeta(_local(m), g) for m in registros.values_list("fecha_registro_cliente", flat=True)
    )
    evolucion = [
        {
            "inicio": etiqueta_iso(c, g),
            "primera_compra": por_compra.get(c, 0),
            "registro": por_registro.get(c, 0),
        }
        for c in cubetas(periodo)
    ]

    compras_por_cliente = Counter(
        _ventas_en(v).exclude(cliente=None).values("cliente").annotate(n=Count("id")).values_list("n", flat=True)
    )
    frecuencia = [
        {
            "clave": clave,
            "etiqueta": etiqueta,
            "clientes": sum(c for n, c in compras_por_cliente.items() if n >= desde and (hasta is None or n <= hasta)),
        }
        for clave, etiqueta, desde, hasta in FRECUENCIAS
    ]

    anterior = None
    if periodo.anterior:
        a = _compradores(periodo.anterior)
        anterior = {
            "activos": a["activos"],
            "nuevos_compra": a["nuevos"],
            "recurrentes": a["recurrentes"],
            "nuevos_registro": Cliente.objects.filter(periodo.anterior.filtro("fecha_registro_cliente")).count(),
        }

    return {
        "registrados": Cliente.objects.filter(fecha_registro_cliente__lt=v.fin).count(),
        "nuevos_registro": registros.count(),
        "activos": compradores["activos"],
        "nuevos_compra": compradores["nuevos"],
        "recurrentes": compradores["recurrentes"],
        "con_compras": historico.count(),
        "inactivos": historico.filter(ultima__lt=referencia).count(),
        "dias_inactividad": DIAS_INACTIVIDAD,
        "evolucion": evolucion,
        "frecuencia": frecuencia,
        "anterior": anterior,
    }


def clientes_destacados(periodo: Periodo, limite: int = 5) -> dict:
    ventas = _ventas_en(periodo.actual)
    total = float(ventas.aggregate(t=Sum("total_pedido"))["t"] or 0)
    top = (
        ventas.exclude(cliente=None)
        .values("cliente_id", "cliente__nombre_cliente")
        .annotate(pedidos=Count("id"), total=Sum("total_pedido"))
        .order_by("-total", "-pedidos")[:limite]
    )
    return {
        "ventas_periodo": total,
        "clientes": [
            {
                "id": c["cliente_id"],
                "nombre": c["cliente__nombre_cliente"],
                "pedidos": c["pedidos"],
                "total": float(c["total"] or 0),
                "participacion": round(float(c["total"] or 0) / total * 100, 1) if total else None,
            }
            for c in top
        ],
    }


# ==========================================================================
# PRODUCTOS
# ==========================================================================
ORDENES_PRODUCTO = ("ingresos", "cantidad", "frecuencia")


def _lineas_vendidas(ventana: Ventana, categoria: int | None = None):
    lineas = DetallePedido.objects.filter(
        pedido__estado=ESTADO_VENTA,
        pedido__fecha_pedido__gte=ventana.inicio,
        pedido__fecha_pedido__lt=ventana.fin,
    )
    if categoria is not None:
        lineas = lineas.filter(
            Q(presentacion__producto__categoria_id=categoria)
            | Q(presentacion__isnull=True, categoria_manual_id=categoria)
        )
    return lineas


def _url_imagen(imagen, request) -> str | None:
    if not imagen:
        return None
    try:
        url = imagen.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request is not None and url.startswith("/") else url


def ranking_productos(
    periodo: Periodo, orden: str = "ingresos", categoria: int | None = None, limite: int = 10, request=None
) -> dict:
    """
    Los productos vendidos del período, agrupando sus presentaciones.

    # Cantidades: nunca se suman unidades incompatibles

    Si el producto tiene `unidad_base`, cada presentación es «factor ×
    unidad base» (la misma regla con la que inventario descuenta existencias),
    y la cantidad se da convertida: 3 bultos de 50 kg + 20 kg sueltos = 170 kg.
    Sin unidad base no hay conversión válida y la cantidad se da por
    presentación, sin total. Ordenar «por cantidad» compara la cantidad
    principal de cada producto (la convertida, o la de su presentación más
    vendida): es la única comparación posible entre productos que se venden en
    unidades distintas, y el panel muestra la unidad al lado de cada número.

    Las líneas escritas a mano (no de catálogo) se agrupan por su nombre.
    """
    lineas = _lineas_vendidas(periodo.actual, categoria)
    ingresos_totales = float(lineas.aggregate(t=Sum("subtotal"))["t"] or 0)

    catalogo = list(
        lineas.filter(presentacion__isnull=False)
        .values("presentacion_id", "presentacion__producto_id")
        .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"))
    )
    frecuencia = {
        x["presentacion__producto_id"]: x["n"]
        for x in lineas.filter(presentacion__isnull=False)
        .values("presentacion__producto_id")
        .annotate(n=Count("pedido", distinct=True))
    }
    productos = {
        p.id: p
        for p in Producto.objects.filter(id__in={x["presentacion__producto_id"] for x in catalogo}).select_related(
            "categoria", "unidad_base"
        )
    }
    presentaciones = {
        p.id: p
        for p in PresentacionProducto.objects.filter(id__in={x["presentacion_id"] for x in catalogo}).select_related(
            "unidad_venta"
        )
    }

    filas: dict[str, dict] = {}
    for x in catalogo:
        producto = productos[x["presentacion__producto_id"]]
        pres = presentaciones[x["presentacion_id"]]
        fila = filas.setdefault(
            f"p{producto.id}",
            {
                "clave": f"p{producto.id}",
                "producto_id": producto.id,
                "nombre": producto.nombre_producto,
                "imagen": _url_imagen(producto.imagen, request),
                "categoria": producto.categoria.nombre_categoria if producto.categoria_id else "Sin categoría",
                "ingresos": Decimal("0"),
                "frecuencia": frecuencia.get(producto.id, 0),
                "_base": Decimal("0"),
                "_unidad_base": producto.unidad_base,
                "desglose": [],
            },
        )
        fila["ingresos"] += x["ingresos"] or 0
        fila["_base"] += (x["cantidad"] or 0) * pres.factor_conversion
        fila["desglose"].append(
            {
                "presentacion": pres.nombre_presentacion,
                "unidad": pres.unidad_venta.abreviatura_unidad or pres.unidad_venta.nombre_unidad,
                "cantidad": float(x["cantidad"] or 0),
            }
        )

    manuales = lineas.filter(presentacion__isnull=True)
    frecuencia_manual = {
        x["nombre_personalizado"]: x["n"]
        for x in manuales.values("nombre_personalizado").annotate(n=Count("pedido", distinct=True))
    }
    for x in manuales.values(
        "nombre_personalizado", "categoria_manual__nombre_categoria", "unidad_personalizada__abreviatura_unidad"
    ).annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal")):
        nombre = x["nombre_personalizado"] or "Producto sin nombre"
        fila = filas.setdefault(
            f"m{nombre}",
            {
                "clave": f"m{nombre}",
                "producto_id": None,
                "nombre": nombre,
                "imagen": None,
                "categoria": x["categoria_manual__nombre_categoria"] or "Sin categoría",
                "ingresos": Decimal("0"),
                "frecuencia": frecuencia_manual.get(x["nombre_personalizado"], 0),
                "_base": None,
                "_unidad_base": None,
                "desglose": [],
            },
        )
        fila["ingresos"] += x["ingresos"] or 0
        fila["desglose"].append(
            {
                "presentacion": "Pedido a mano",
                "unidad": x["unidad_personalizada__abreviatura_unidad"] or "",
                "cantidad": float(x["cantidad"] or 0),
            }
        )

    for fila in filas.values():
        base = fila.pop("_unidad_base")
        convertida = fila.pop("_base")
        fila["desglose"].sort(key=lambda d: -d["cantidad"])
        if base is not None:
            fila["cantidad"] = {
                "valor": float(convertida),
                "unidad": base.abreviatura_unidad or base.nombre_unidad,
                "convertida": True,
            }
        else:
            principal = fila["desglose"][0]
            fila["cantidad"] = {
                "valor": principal["cantidad"],
                "unidad": principal["presentacion"] if principal["presentacion"] != "Pedido a mano" else principal["unidad"],
                "convertida": False,
            }
        fila["ingresos"] = float(fila["ingresos"])
        fila["participacion"] = round(fila["ingresos"] / ingresos_totales * 100, 1) if ingresos_totales else 0.0

    clave_orden = {
        "ingresos": lambda f: (f["ingresos"], f["frecuencia"]),
        "cantidad": lambda f: (f["cantidad"]["valor"], f["ingresos"]),
        "frecuencia": lambda f: (f["frecuencia"], f["ingresos"]),
    }[orden]
    ordenadas = sorted(filas.values(), key=clave_orden, reverse=True)
    for i, fila in enumerate(ordenadas, start=1):
        fila["posicion"] = i

    return {
        "orden": orden,
        "categoria": categoria,
        "ingresos_totales": ingresos_totales,
        "total_productos": len(ordenadas),
        "productos": ordenadas[:limite],
    }


# ==========================================================================
# CATEGORÍAS
# ==========================================================================
def _por_categoria(ventana: Ventana) -> list[dict]:
    return list(
        _lineas_vendidas(ventana)
        .annotate(
            cat_id=Coalesce("presentacion__producto__categoria_id", "categoria_manual_id"),
            cat_nombre=Coalesce(
                "presentacion__producto__categoria__nombre_categoria", "categoria_manual__nombre_categoria"
            ),
        )
        .values("cat_id", "cat_nombre")
        .annotate(ingresos=Sum("subtotal"), pedidos=Count("pedido", distinct=True))
    )


def ventas_por_categoria(periodo: Periodo) -> dict:
    actual = _por_categoria(periodo.actual)
    total = float(sum((x["ingresos"] or 0) for x in actual))
    previas = None
    if periodo.anterior:
        previas = {x["cat_id"]: float(x["ingresos"] or 0) for x in _por_categoria(periodo.anterior)}

    categorias = sorted(
        (
            {
                "id": x["cat_id"],
                "nombre": x["cat_nombre"] or "Sin categoría",
                "ingresos": float(x["ingresos"] or 0),
                "pedidos": x["pedidos"],
                "participacion": round(float(x["ingresos"] or 0) / total * 100, 1) if total else 0.0,
                "anterior": previas.get(x["cat_id"], 0.0) if previas is not None else None,
            }
            for x in actual
        ),
        key=lambda c: c["ingresos"],
        reverse=True,
    )
    return {"total": total, "categorias": categorias}


# ==========================================================================
# OPERACIÓN
# ==========================================================================
def operacion_abierta() -> dict:
    """
    El trabajo pendiente, sin importar la fecha del pedido: un pendiente de
    ayer sigue siendo trabajo de hoy. Y los entregados hoy (por lote de
    entrega, o sin lote porque se marcaron hoy).
    """
    hoy = timezone.localdate()
    abiertos = {
        x["estado"]: x["n"]
        for x in Pedido.objects.filter(estado__in=ESTADOS_ABIERTOS).values("estado").annotate(n=Count("id"))
    }
    entregados_hoy = (
        Pedido.objects.filter(estado=ESTADO_VENTA)
        .filter(
            Q(lotes__tipo="ENTREGA", lotes__fecha_creacion__date=hoy)
            | (Q(fecha_modificacion__date=hoy) & ~Q(lotes__tipo="ENTREGA"))
        )
        .distinct()
        .count()
    )
    return {"abiertos": {e: abiertos.get(e, 0) for e in ESTADOS_ABIERTOS}, "entregados_hoy": entregados_hoy}


def resumen_operativo(periodo: Periodo) -> dict:
    pedidos = _pedidos_en(periodo.actual)
    por_estado = {x["estado"]: x["n"] for x in pedidos.values("estado").annotate(n=Count("id"))}
    recibidos = sum(por_estado.values())
    entregados = por_estado.get(ESTADO_VENTA, 0)
    return {
        "recibidos": recibidos,
        "por_estado": {e: por_estado.get(e, 0) for e in ESTADOS},
        # Cumplimiento: de lo que entró en el período, cuánto ya se entregó.
        "cumplimiento": round(entregados / recibidos * 100, 1) if recibidos else None,
        **operacion_abierta(),
    }


def pedidos_recientes(limite: int = 8, desplazamiento: int = 0) -> dict:
    qs = Pedido.objects.select_related("cliente").annotate(num_items=Count("detalles")).order_by("-fecha_pedido", "-id")
    pagina = list(qs[desplazamiento : desplazamiento + limite + 1])
    return {
        "hay_mas": len(pagina) > limite,
        "pedidos": [
            {
                "id": p.id,
                "cliente": p.cliente.nombre_cliente if p.cliente else "",
                "cliente_id": p.cliente_id,
                "estado": p.estado,
                "fecha": p.fecha_pedido,
                "total": float(p.total_pedido),
                "num_items": p.num_items,
            }
            for p in pagina[:limite]
        ],
    }
