"""
Resumen de estadísticas del dashboard administrativo.

Portado de `estadisticas_resumen_view`. NOTA: el código original filtraba por
estados 'COMPLETADO'/'PROCESANDO' que no existen en el modelo Pedido
(cuyos estados reales son PENDIENTE/EDITADO/CERRADO/ENTREGADO/IMPRESO). Aquí se
usa 'ENTREGADO' como venta concretada y 'PENDIENTE' como pendiente, que es la
semántica correcta del dominio.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDay, TruncHour, TruncWeek
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.viewsets import ExigeNegocioMixin

from apps.catalog.models import Categoria, Producto

from apps.common.permissions import EsStaff

from .models import Cliente, DetallePedido, Pedido

Usuario = get_user_model()

ESTADO_VENTA = "ENTREGADO"
META_ANUAL = 100_000_000
DIAS_MAX_REPORTE = 366


class ResumenEstadisticasView(ExigeNegocioMixin, APIView):
    permission_classes = [EsStaff]

    def get(self, request):
        ahora = timezone.now()
        hace_24h = ahora - timedelta(days=1)
        primer_dia_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        primer_dia_mes_ant = primer_dia_mes - relativedelta(months=1)
        primer_dia_anio = ahora.replace(month=1, day=1, hour=0, minute=0, second=0)

        def total_ventas(**filtros):
            return (
                Pedido.objects.filter(estado=ESTADO_VENTA, **filtros).aggregate(
                    total=Sum("total_pedido")
                )["total"]
                or 0
            )

        caja_hoy = total_ventas(fecha_pedido__date=ahora.date())
        pedidos_hoy = Pedido.objects.filter(fecha_pedido__date=ahora.date()).count()
        completados_hoy = Pedido.objects.filter(
            fecha_pedido__date=ahora.date(), estado=ESTADO_VENTA
        ).count()
        eficiencia = (completados_hoy / pedidos_hoy * 100) if pedidos_hoy else 100

        ventas_mes = total_ventas(fecha_pedido__gte=primer_dia_mes)
        ventas_mes_ant = total_ventas(
            fecha_pedido__gte=primer_dia_mes_ant, fecha_pedido__lt=primer_dia_mes
        )
        crecimiento = 0
        if ventas_mes_ant > 0:
            crecimiento = ((ventas_mes - ventas_mes_ant) / ventas_mes_ant) * 100

        ventas_anio = total_ventas(fecha_pedido__gte=primer_dia_anio)
        progreso_meta = min(int((ventas_anio / META_ANUAL) * 100), 100) if META_ANUAL else 0

        pendientes = Pedido.objects.filter(estado="PENDIENTE").count()
        # Productos escritos a mano por clientes que esperan aprobación (la
        # cola de "Productos pendientes"). Va aquí porque el panel ya consulta
        # este resumen para su barra superior: el contador del menú no cuesta
        # una petición más, y contar en la base evita bajar la lista entera.
        por_revisar = DetallePedido.objects.filter(
            es_catalogo=False, estado_revision="PENDIENTE"
        ).count()

        # Ventas últimos 7 días
        ventas_7d = (
            Pedido.objects.filter(
                fecha_pedido__gte=ahora - timedelta(days=6), estado=ESTADO_VENTA
            )
            .annotate(dia=TruncDay("fecha_pedido"))
            .values("dia")
            .annotate(total=Sum("total_pedido"))
            .order_by("dia")
        )
        dias_labels, ventas_data = [], []
        for i in range(7):
            fecha = (ahora - timedelta(days=6 - i)).date()
            dias_labels.append(fecha.strftime("%d %b"))
            total_dia = next(
                (x["total"] for x in ventas_7d if x["dia"].date() == fecha), 0
            )
            ventas_data.append(float(total_dia or 0))

        # Top productos
        top = (
            Producto.objects.annotate(
                total_vendidos=Count("presentaciones__detallepedido")
            ).order_by("-total_vendidos")[:5]
        )
        top_productos = [
            {"nombre": p.nombre_producto, "cantidad": p.total_vendidos or 0}
            for p in top
        ] or [{"nombre": "Sin ventas", "cantidad": 0}]

        # Productos por categoría
        por_categoria = Categoria.objects.annotate(
            num_productos=Count("productos")
        ).order_by("-num_productos")

        # Actividad reciente
        actividades = []
        for c in Cliente.objects.filter(fecha_registro_cliente__gte=hace_24h).order_by(
            "-fecha_registro_cliente"
        )[:3]:
            actividades.append({"tipo": "cliente", "msj": f"Nuevo cliente: {c.nombre_cliente}"})
        for p in Pedido.objects.filter(fecha_pedido__gte=hace_24h).order_by("-id")[:3]:
            actividades.append({"tipo": "pedido", "msj": f"Pedido #{p.id} recibido"})

        ultimos = (
            Pedido.objects.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-id")[:5]
        )

        return Response(
            {
                "caja_hoy": caja_hoy,
                "eficiencia": round(eficiencia, 1),
                "ventas_mes": ventas_mes,
                "crecimiento_mensual": round(crecimiento, 1),
                "ventas_anio": ventas_anio,
                "progreso_meta": progreso_meta,
                "pedidos_pendientes": pendientes,
                "productos_por_revisar": por_revisar,
                "total_clientes": Cliente.objects.count(),
                "total_productos": Producto.objects.count(),
                "total_categorias": Categoria.objects.count(),
                "total_usuarios": Usuario.objects.filter(is_active=True).count(),
                "ventas_7dias": {"labels": dias_labels, "data": ventas_data},
                "top_productos": top_productos,
                "productos_por_categoria": [
                    {"categoria": c.nombre_categoria, "total": c.num_productos}
                    for c in por_categoria
                ],
                "actividad_reciente": actividades,
                "ultimos_pedidos": [
                    {
                        "id": p.id,
                        "cliente": p.cliente.nombre_cliente if p.cliente else "",
                        "estado": p.estado,
                        "total": p.total_pedido,
                        "num_items": p.num_items,
                        "fecha": p.fecha_pedido,
                    }
                    for p in ultimos
                ],
            }
        )


class ReporteVentasView(ExigeNegocioMixin, APIView):
    """
    Reporte de ventas para un rango de fechas personalizado.
    Alimenta los gráficos del dashboard y sirve como fuente para la
    exportación a Excel (el detalle de `pedidos` trae todas las filas
    exportables; el front decide qué columnas mostrar/exportar).
    """

    permission_classes = [EsStaff]

    def get(self, request):
        hoy = timezone.now().date()

        def parsear_fecha(valor, campo):
            try:
                return date.fromisoformat(valor)
            except (TypeError, ValueError):
                raise ValueError(f"El parámetro '{campo}' debe tener formato AAAA-MM-DD.")

        try:
            desde = parsear_fecha(
                request.query_params.get("desde"), "desde"
            ) if request.query_params.get("desde") else hoy - timedelta(days=29)
            hasta = parsear_fecha(
                request.query_params.get("hasta"), "hasta"
            ) if request.query_params.get("hasta") else hoy
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        if desde > hasta:
            return Response(
                {"detail": "'desde' no puede ser posterior a 'hasta'."}, status=400
            )
        if (hasta - desde).days > DIAS_MAX_REPORTE:
            return Response(
                {"detail": f"El rango no puede superar {DIAS_MAX_REPORTE} días."},
                status=400,
            )

        pedidos_rango = Pedido.objects.filter(
            fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta
        )
        pedidos_venta = pedidos_rango.filter(estado=ESTADO_VENTA)

        total_ventas = pedidos_venta.aggregate(total=Sum("total_pedido"))["total"] or 0
        total_pedidos = pedidos_venta.count()
        ticket_promedio = (total_ventas / total_pedidos) if total_pedidos else 0

        clientes_nuevos = Cliente.objects.filter(
            fecha_registro_cliente__date__gte=desde,
            fecha_registro_cliente__date__lte=hasta,
        ).count()

        por_dia = (
            pedidos_venta.annotate(dia=TruncDay("fecha_pedido"))
            .values("dia")
            .annotate(total=Sum("total_pedido"))
            .order_by("dia")
        )
        num_dias = (hasta - desde).days + 1
        dias_labels, ventas_data = [], []
        for i in range(num_dias):
            fecha = desde + timedelta(days=i)
            dias_labels.append(fecha.strftime("%d %b"))
            total_dia = next(
                (x["total"] for x in por_dia if x["dia"].date() == fecha), 0
            )
            ventas_data.append(float(total_dia or 0))

        detalles = DetallePedido.objects.filter(pedido__in=pedidos_venta).select_related(
            "presentacion__producto__categoria", "categoria_manual"
        )

        productos_acc = defaultdict(lambda: {"cantidad": Decimal("0"), "total": Decimal("0")})
        categorias_acc = defaultdict(Decimal)
        total_unidades = Decimal("0")

        for d in detalles:
            total_unidades += d.cantidad
            if d.presentacion_id and d.presentacion.producto_id:
                nombre = d.presentacion.producto.nombre_producto
                cat = (
                    d.presentacion.producto.categoria.nombre_categoria
                    if d.presentacion.producto.categoria_id
                    else "Sin categoría"
                )
            else:
                nombre = d.nombre_personalizado or "Personalizado"
                cat = (
                    d.categoria_manual.nombre_categoria
                    if d.categoria_manual_id
                    else "Sin categoría"
                )
            productos_acc[nombre]["cantidad"] += d.cantidad
            productos_acc[nombre]["total"] += d.subtotal
            categorias_acc[cat] += d.subtotal

        top_productos = sorted(
            (
                {"nombre": n, "cantidad": float(v["cantidad"]), "total": float(v["total"])}
                for n, v in productos_acc.items()
            ),
            key=lambda x: x["total"],
            reverse=True,
        )[:10]

        ventas_por_categoria = sorted(
            (
                {"categoria": c, "total": float(t)}
                for c, t in categorias_acc.items()
            ),
            key=lambda x: x["total"],
            reverse=True,
        )

        pedidos_detalle = [
            {
                "id": p.id,
                "fecha": p.fecha_pedido,
                "cliente": p.cliente.nombre_cliente if p.cliente else "",
                "estado": p.estado,
                "num_items": p.num_items,
                "total": p.total_pedido,
            }
            for p in pedidos_rango.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-fecha_pedido")
        ]

        return Response(
            {
                "desde": desde,
                "hasta": hasta,
                "total_ventas": total_ventas,
                "total_pedidos": total_pedidos,
                "ticket_promedio": round(float(ticket_promedio), 2),
                "total_unidades_vendidas": float(total_unidades),
                "clientes_nuevos": clientes_nuevos,
                "ventas_por_dia": {"labels": dias_labels, "data": ventas_data},
                "ventas_por_categoria": ventas_por_categoria,
                "top_productos": top_productos,
                "pedidos": pedidos_detalle,
            }
        )


# ==========================================================================
# EL PANEL: UNA SOLA PETICIÓN POR PERÍODO
# ==========================================================================
#: Los estados en que un pedido todavía necesita que alguien haga algo.
ESTADOS_ABIERTOS = ("PENDIENTE", "EDITADO", "CERRADO", "IMPRESO")

#: Hasta cuántos días la serie va por día; por encima, por semana (un año
#: día a día son 366 puntos que nadie lee).
DIAS_MAX_SERIE_DIARIA = 62


def _rango_de(request):
    """(desde, hasta) del query string, o un error listo para responder."""
    hoy = timezone.localdate()

    def fecha(clave, defecto):
        valor = request.query_params.get(clave)
        if not valor:
            return defecto
        try:
            return date.fromisoformat(valor)
        except ValueError:
            raise ValueError(f"El parámetro '{clave}' debe tener formato AAAA-MM-DD.")

    try:
        desde = fecha("desde", hoy - timedelta(days=29))
        hasta = fecha("hasta", hoy)
    except ValueError as e:
        return None, Response({"detail": str(e)}, status=400)
    if desde > hasta:
        return None, Response({"detail": "'desde' no puede ser posterior a 'hasta'."}, status=400)
    if (hasta - desde).days > DIAS_MAX_REPORTE:
        return None, Response(
            {"detail": f"El rango no puede superar {DIAS_MAX_REPORTE} días."}, status=400
        )
    return (desde, hasta), None


def _pedidos_entre(desde, hasta):
    return Pedido.objects.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)


def _serie(pedidos_venta, desde, hasta):
    """
    Las ventas del período en cubetas que se puedan leer: por hora si es un
    solo día, por día hasta dos meses, por semana más allá. Cada cubeta sale
    aunque esté vacía —un día sin ventas es información—, con su inicio en ISO
    para que el panel la nombre en su idioma.
    """
    dias = (hasta - desde).days + 1
    if dias == 1:
        granularidad, trunc = "hora", TruncHour("fecha_pedido")
    elif dias <= DIAS_MAX_SERIE_DIARIA:
        granularidad, trunc = "dia", TruncDay("fecha_pedido")
    else:
        granularidad, trunc = "semana", TruncWeek("fecha_pedido")

    agrupado = {
        timezone.localtime(x["cubeta"]).replace(tzinfo=None): x
        for x in pedidos_venta.annotate(cubeta=trunc)
        .values("cubeta")
        .annotate(total=Sum("total_pedido"), pedidos=Count("id"))
    }

    if granularidad == "hora":
        inicios = [datetime.combine(desde, time(h)) for h in range(24)]
    elif granularidad == "dia":
        inicios = [datetime.combine(desde + timedelta(days=i), time()) for i in range(dias)]
    else:
        lunes = desde - timedelta(days=desde.weekday())
        inicios = []
        while lunes <= hasta:
            inicios.append(datetime.combine(lunes, time()))
            lunes += timedelta(days=7)

    serie = []
    for inicio in inicios:
        fila = agrupado.get(inicio, {})
        serie.append(
            {
                "inicio": inicio.isoformat() if granularidad == "hora" else inicio.date().isoformat(),
                "total": float(fila.get("total") or 0),
                "pedidos": fila.get("pedidos", 0),
            }
        )
    return granularidad, serie


class PanelEstadisticasView(ExigeNegocioMixin, APIView):
    """
    Todo lo que el dashboard necesita para un período, calculado en la base.

    Existe porque el dashboard componía sus números con dos peticiones —el
    resumen fijo del mes y el reporte del rango, que además trae TODAS las
    filas de pedidos para el Excel— y aun así le faltaba lo que hace
    accionable un número: contra qué compararlo, qué pedidos esperan a
    alguien y qué clientes están volviendo.

    # Definiciones (las mismas del resto de estadísticas)

    - Venta: un pedido ENTREGADO; su fecha es la del pedido.
    - Período anterior: los mismos días inmediatamente antes de `desde`.
    - Clientes activos: con al menos un pedido en el período. "Volvieron a
      pedir": los activos que ya habían pedido antes del período.
    - Más solicitados: en cuántos pedidos del período aparece cada producto
      (las cantidades no se suman entre sí: una libra y un bulto no son lo
      mismo).
    - Operación: pedidos abiertos por estado, sin importar su fecha —el
      trabajo pendiente es de hoy aunque el pedido sea de ayer—, y los
      entregados hoy (por lote de entrega o, sin lote, porque se marcaron hoy).

    No reemplaza a `ReporteVentasView`: el Excel sigue saliendo de ahí.
    """

    permission_classes = [EsStaff]

    def get(self, request):
        rango, error = _rango_de(request)
        if error:
            return error
        desde, hasta = rango
        dias = (hasta - desde).days + 1
        ant_hasta = desde - timedelta(days=1)
        ant_desde = ant_hasta - timedelta(days=dias - 1)

        pedidos = _pedidos_entre(desde, hasta)
        pedidos_ant = _pedidos_entre(ant_desde, ant_hasta)
        ventas = pedidos.filter(estado=ESTADO_VENTA)
        ventas_ant = pedidos_ant.filter(estado=ESTADO_VENTA)

        def resumen_ventas(qs):
            r = qs.aggregate(total=Sum("total_pedido"), n=Count("id"))
            return float(r["total"] or 0), r["n"]

        total, entregados = resumen_ventas(ventas)
        total_ant, entregados_ant = resumen_ventas(ventas_ant)

        por_estado = {
            x["estado"]: x["n"] for x in pedidos.values("estado").annotate(n=Count("id"))
        }

        # --- clientes ------------------------------------------------------
        activos = pedidos.exclude(cliente=None).values("cliente").distinct()
        recurrentes = (
            Pedido.objects.filter(cliente__in=activos, fecha_pedido__date__lt=desde)
            .values("cliente")
            .distinct()
            .count()
        )

        def nuevos(a, b):
            return Cliente.objects.filter(
                fecha_registro_cliente__date__gte=a, fecha_registro_cliente__date__lte=b
            ).count()

        top_clientes = (
            pedidos.exclude(cliente=None)
            .values("cliente_id", "cliente__nombre_cliente")
            .annotate(pedidos=Count("id"), total=Sum("total_pedido"))
            .order_by("-pedidos", "-total")[:5]
        )

        # --- productos y categorías ----------------------------------------
        mas_solicitados = (
            DetallePedido.objects.filter(pedido__in=pedidos)
            .annotate(
                nombre=Coalesce(
                    "presentacion__producto__nombre_producto",
                    "nombre_personalizado",
                    Value("Producto sin nombre"),
                )
            )
            .values("nombre")
            .annotate(pedidos=Count("pedido", distinct=True), total=Sum("subtotal"))
            .order_by("-pedidos", "-total")[:8]
        )
        por_categoria = (
            DetallePedido.objects.filter(pedido__in=ventas)
            .annotate(
                categoria=Coalesce(
                    "presentacion__producto__categoria__nombre_categoria",
                    "categoria_manual__nombre_categoria",
                    Value("Sin categoría"),
                )
            )
            .values("categoria")
            .annotate(total=Sum("subtotal"))
            .order_by("-total")
        )

        # --- operación -----------------------------------------------------
        hoy = timezone.localdate()
        abiertos = {
            x["estado"]: x["n"]
            for x in Pedido.objects.filter(estado__in=ESTADOS_ABIERTOS)
            .values("estado")
            .annotate(n=Count("id"))
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

        recientes = (
            Pedido.objects.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-fecha_pedido", "-id")[:6]
        )

        granularidad, serie = _serie(ventas, desde, hasta)

        return Response(
            {
                "desde": desde,
                "hasta": hasta,
                "anterior": {"desde": ant_desde, "hasta": ant_hasta},
                "ventas": {"total": total, "anterior": total_ant},
                "pedidos": {
                    "total": sum(por_estado.values()),
                    "anterior": pedidos_ant.count(),
                    "por_estado": por_estado,
                },
                "ticket": {
                    "promedio": round(total / entregados, 2) if entregados else None,
                    "anterior": round(total_ant / entregados_ant, 2) if entregados_ant else None,
                    "entregados": entregados,
                },
                "clientes": {
                    "nuevos": nuevos(desde, hasta),
                    "nuevos_anterior": nuevos(ant_desde, ant_hasta),
                    "activos": activos.count(),
                    "recurrentes": recurrentes,
                    "top": [
                        {
                            "id": c["cliente_id"],
                            "nombre": c["cliente__nombre_cliente"],
                            "pedidos": c["pedidos"],
                            "total": float(c["total"] or 0),
                        }
                        for c in top_clientes
                    ],
                },
                "granularidad": granularidad,
                "serie": serie,
                "productos": [
                    {"nombre": p["nombre"], "pedidos": p["pedidos"], "total": float(p["total"] or 0)}
                    for p in mas_solicitados
                ],
                "categorias": [
                    {"categoria": c["categoria"], "total": float(c["total"] or 0)}
                    for c in por_categoria
                ],
                "operacion": {
                    "abiertos": {e: abiertos.get(e, 0) for e in ESTADOS_ABIERTOS},
                    "entregados_hoy": entregados_hoy,
                },
                "recientes": [
                    {
                        "id": p.id,
                        "cliente": p.cliente.nombre_cliente if p.cliente else "",
                        "estado": p.estado,
                        "fecha": p.fecha_pedido,
                        "total": float(p.total_pedido),
                        "num_items": p.num_items,
                    }
                    for p in recientes
                ],
            }
        )
