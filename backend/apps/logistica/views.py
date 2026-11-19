"""
Las rutas del plano de carga.

Mismo guardia que la caja, la agenda y los domicilios: el módulo tiene que
estar contratado Y encendido, y se comprueba una vez por petición en
`initial()`. (Cuarta copia de estas líneas; ver la nota en
`delivery/views.py` sobre por qué todavía no se extraen.)
"""
import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.business.aplicar import modulos_activos
from apps.common.permissions import requiere_permiso
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from apps.orders.models import Pedido

from .models import Furgon, PedidoDespacho, PlanoCarga, TipoCanastilla
from .serializers import (
    FurgonSerializer,
    PlanoCargaListaSerializer,
    PlanoCargaSerializer,
    TipoCanastillaSerializer,
    calcular_rejilla,
    pedido_resumen,
    revisar,
)


def _fecha(texto: str):
    try:
        return datetime.date.fromisoformat(texto)
    except (TypeError, ValueError):
        return None

#: Slug del módulo en el catálogo comercial (`billing`). Nombrado una sola vez.
MODULO = "plano-carga"

VER = "logistica.view_planocarga"
ARMAR = "logistica.add_planocarga"
ADMINISTRAR = "logistica.change_furgon"

ESCRITURA = ("create", "update", "partial_update", "destroy")


class ExigeModuloPlanoCarga(ExigeNegocioMixin):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if MODULO not in modulos_activos(self.obtener_tenant()):
            raise PermissionDenied("El plano de carga no está activo en este negocio.")


class FurgonViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Los vehículos y su espacio de carga."""

    serializer_class = FurgonSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Furgon
    pagination_class = None  # catálogo corto que alimenta un <select>

    def get_permissions(self):
        if self.action in ESCRITURA:
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        if instance.planos.exists():
            raise ValidationError("Este furgón tiene planos guardados: desactívalo en vez de eliminarlo.")
        instance.delete()


class TipoCanastillaViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Las canastillas que se cargan."""

    serializer_class = TipoCanastillaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = TipoCanastilla
    pagination_class = None

    def get_permissions(self):
        if self.action in ESCRITURA:
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        if instance.planos.exists():
            raise ValidationError("Esta canastilla se usa en planos guardados: desactívala en vez de eliminarla.")
        instance.delete()


class PlanoCargaViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Los despachos guardados, con su acomodo."""

    permission_classes = [requiere_permiso(VER)]
    modelo = PlanoCarga

    def get_queryset(self):
        qs = super().get_queryset().select_related("furgon", "tipo_canastilla", "creado_por", "confirmado_por")
        fecha = self.request.query_params.get("fecha")
        if fecha:
            qs = qs.filter(fecha=_fecha(fecha))
        return qs

    def perform_destroy(self, instance):
        if instance.estado == PlanoCarga.CONFIRMADO:
            raise ValidationError("El despacho está confirmado: reábrelo antes de eliminarlo.")
        instance.delete()

    def _armar(self):
        if not requiere_permiso(ARMAR)().has_permission(self.request, self):
            raise PermissionDenied("No tienes permiso para armar despachos.")

    @action(detail=True, methods=["post"])
    def confirmar(self, request, pk=None):
        """Revisa el despacho y, si no hay errores, lo deja confirmado."""
        self._armar()
        with transaction.atomic():
            plano = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if plano.estado == PlanoCarga.CONFIRMADO:
                raise ValidationError("El despacho ya está confirmado.")
            rev = revisar(
                {"grupos": plano.grupos, "posiciones": plano.posiciones, "medidas": plano.medidas},
                plano.furgon, plano.tipo_canastilla,
            )
            if rev["errores"]:
                return Response({"detail": "El despacho tiene errores.", "revision": rev}, status=400)
            plano.estado = PlanoCarga.CONFIRMADO
            plano.confirmado_por = request.user
            plano.confirmado_en = timezone.now()
            plano.save(update_fields=["estado", "confirmado_por", "confirmado_en", "actualizado"])
        return Response(PlanoCargaSerializer(plano, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def reabrir(self, request, pk=None):
        """Vuelve a borrador un despacho confirmado, para corregirlo."""
        self._armar()
        plano = self.get_object()
        plano.estado = PlanoCarga.BORRADOR
        plano.confirmado_por = None
        plano.confirmado_en = None
        plano.save(update_fields=["estado", "confirmado_por", "confirmado_en", "actualizado"])
        return Response(PlanoCargaSerializer(plano, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        """
        Copia un plan a otra fecha: mismo vehículo, destinos y acomodo, pero SIN
        pedidos (cada pedido va en un solo despacho; se asignan de nuevo).
        """
        self._armar()
        origen = self.get_object()
        fecha = _fecha(request.data.get("fecha") or "") or origen.fecha
        copia = PlanoCarga.objects.create(
            tenant=origen.tenant,
            nombre=f"{origen.nombre} (copia)"[:120],
            fecha=fecha,
            furgon=origen.furgon,
            tipo_canastilla=origen.tipo_canastilla,
            medidas=origen.medidas,
            grupos=origen.grupos,
            posiciones=origen.posiciones,
            notas=origen.notas,
            creado_por=request.user,
        )
        return Response(PlanoCargaSerializer(copia, context=self.get_serializer_context()).data, status=201)

    @action(detail=False, methods=["get"])
    def planificacion(self, request):
        """
        Los pedidos que se entregan en `?fecha=AAAA-MM-DD` (su fecha programada,
        no la de creación) y a qué despacho va cada uno.
        """
        fecha = _fecha(request.query_params.get("fecha", ""))
        if not fecha:
            raise ValidationError("Indica la fecha (AAAA-MM-DD).")
        tenant = self.obtener_tenant()
        pedidos = (
            Pedido.objects.filter(tenant=tenant, fecha_programada__date=fecha)
            .exclude(estado="ENTREGADO")
            .select_related("cliente")
            .order_by("cliente__nombre_cliente", "id")
        )
        asignados = {
            a.pedido_id: a
            for a in PedidoDespacho.objects.filter(pedido__in=pedidos).select_related("plano")
        }
        filas = []
        for p in pedidos:
            a = asignados.get(p.id)
            filas.append({
                **pedido_resumen(p),
                "despacho": {"id": a.plano_id, "nombre": a.plano.nombre, "estado": a.plano.estado} if a else None,
                "canastillas": a.canastillas if a else None,
            })
        con = [f for f in filas if f["despacho"]]
        return Response({
            "fecha": fecha.isoformat(),
            "pedidos": filas,
            "resumen": {
                "pedidos": len(filas),
                "asignados": len(con),
                "sin_vehiculo": len(filas) - len(con),
                "canastillas": sum(f["canastillas"] or 0 for f in con),
                "despachos": PlanoCarga.objects.filter(tenant=tenant, fecha=fecha).count(),
            },
        })

    def get_serializer_class(self):
        return PlanoCargaListaSerializer if self.action == "list" else PlanoCargaSerializer

    def get_permissions(self):
        if self.action in ESCRITURA:
            return [requiere_permiso(ARMAR)()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(tenant=self.obtener_tenant(), creado_por=self.request.user)

    @action(detail=False, methods=["get"])
    def rejilla(self, request):
        """
        La rejilla de un furgón con una canastilla, para armar un plano nuevo
        antes de guardarlo. `?furgon=<id>&tipo_canastilla=<id>`.
        """
        tenant = self.obtener_tenant()
        try:
            furgon = Furgon.objects.get(tenant=tenant, pk=int(request.query_params.get("furgon", "")))
            tipo = TipoCanastilla.objects.get(tenant=tenant, pk=int(request.query_params.get("tipo_canastilla", "")))
        except (ValueError, Furgon.DoesNotExist, TipoCanastilla.DoesNotExist):
            raise ValidationError("Indica un furgón y una canastilla válidos.")
        return Response(calcular_rejilla(furgon, tipo))
