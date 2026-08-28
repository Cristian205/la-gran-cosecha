"""
Resumen de estadísticas del dashboard administrativo.

Portado de `estadisticas_resumen_view`. NOTA: el código original filtraba por
estados 'COMPLETADO'/'PROCESANDO' que no existen en el modelo Pedido
(cuyos estados reales son PENDIENTE/EDITADO/CERRADO/ENTREGADO/IMPRESO). Aquí se
usa 'ENTREGADO' como venta concretada y 'PENDIENTE' como pendiente, que es la
semántica correcta del dominio.
"""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import TruncDay
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
