"""
Rutas de la planificación logística: programación semanal, ajustes por fecha,
reglas de carga y el centro de planificación diaria.

Mismo guardia que el resto del plano de carga (`ExigeModuloPlanoCarga`).
Permisos: mirar = ver planos; programar rutas y reglas = administrar
vehículos; ajustar el día y generar despachos = armar despachos.
"""
import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.catalog.models import PresentacionProducto
from apps.common.permissions import requiere_permiso
from apps.tenancy.viewsets import TenantScopedMixin

from .models import AjusteRuta, ParadaRuta, ProgramacionSemanal, ReglaCarga, Ruta, TipoCanastilla
from .planificacion import generar, proponer
from .serializers import PlanoCargaListaSerializer
from .serializers_rutas import AjusteRutaSerializer, ProgramacionSemanalSerializer, RutaSerializer
from .views import ADMINISTRAR, ARMAR, ESCRITURA, VER, ExigeModuloPlanoCarga, _fecha


class ProgramacionSemanalViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Las plantillas de programación semanal. Una sola está activa."""

    serializer_class = ProgramacionSemanalSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = ProgramacionSemanal
    pagination_class = None

    def get_permissions(self):
        if self.action in (*ESCRITURA, "activar", "duplicar"):
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def perform_create(self, serializer):
        tenant = self.obtener_tenant()
        # La primera plantilla del negocio queda activa: sin eso el centro de
        # planificación no vería ninguna ruta y no se entendería por qué.
        primera = not ProgramacionSemanal.objects.filter(tenant=tenant).exists()
        serializer.save(tenant=tenant, activa=primera)

    def perform_destroy(self, instance):
        if instance.activa:
            raise ValidationError("Es la programación activa: activa otra antes de eliminarla.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        prog = self.get_object()
        with transaction.atomic():
            ProgramacionSemanal.objects.filter(tenant=prog.tenant, activa=True).exclude(pk=prog.pk).update(activa=False)
            prog.activa = True
            prog.save(update_fields=["activa", "actualizado"])
        return Response(self.get_serializer(prog).data)

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        """Copia la plantilla con todas sus rutas y paradas (queda inactiva)."""
        origen = self.get_object()
        nombre = str(request.data.get("nombre") or f"{origen.nombre} (copia)").strip()[:80]
        with transaction.atomic():
            copia = ProgramacionSemanal.objects.create(tenant=origen.tenant, nombre=nombre, notas=origen.notas)
            for r in origen.rutas.prefetch_related("paradas"):
                nueva = Ruta.objects.create(
                    tenant=origen.tenant, programacion=copia, dia_semana=r.dia_semana, nombre=r.nombre,
                    furgon_id=r.furgon_id, color=r.color, notas=r.notas,
                )
                ParadaRuta.objects.bulk_create(
                    [
                        ParadaRuta(tenant=origen.tenant, ruta=nueva, cliente_id=p.cliente_id, orden=p.orden, nota=p.nota)
                        for p in r.paradas.all()
                    ]
                )
        return Response(self.get_serializer(copia).data, status=201)


class RutaViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Las rutas de una programación: `?programacion=<id>&dia=<0-6>`."""

    serializer_class = RutaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Ruta
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset().select_related("furgon", "programacion")
        prog = self.request.query_params.get("programacion")
        dia = self.request.query_params.get("dia")
        if prog and prog.isdigit():
            qs = qs.filter(programacion_id=int(prog))
        if dia and dia.isdigit():
            qs = qs.filter(dia_semana=int(dia))
        return qs

    def get_permissions(self):
        if self.action in ESCRITURA:
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()


class AjusteRutaViewSet(ExigeModuloPlanoCarga, TenantScopedMixin, viewsets.ModelViewSet):
    """Cambios de ruta para una fecha concreta: `?fecha=AAAA-MM-DD`."""

    serializer_class = AjusteRutaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = AjusteRuta
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset().select_related("furgon", "ruta")
        fecha = _fecha(self.request.query_params.get("fecha", ""))
        if fecha:
            qs = qs.filter(fecha=fecha)
        return qs

    def get_permissions(self):
        if self.action in ESCRITURA:
            return [requiere_permiso(ARMAR)()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(tenant=self.obtener_tenant(), creado_por=self.request.user)


def _decimal_o_nulo(valor, campo, maximo):
    if valor in (None, ""):
        return None
    try:
        d = Decimal(str(valor))
    except InvalidOperation:
        raise ValidationError(f"«{campo}» debe ser un número.")
    if d <= 0 or d > maximo:
        raise ValidationError(f"«{campo}» debe ser mayor que 0 y como máximo {maximo}.")
    return d


class ReglaCargaViewSet(ExigeModuloPlanoCarga, viewsets.ViewSet):
    """
    Reglas de carga por presentación del catálogo. GET lista las
    presentaciones activas con su regla; POST `guardar/` las actualiza en
    bloque (los dos valores vacíos = sin regla).
    """

    permission_classes = [requiere_permiso(VER)]

    def get_permissions(self):
        if self.action == "guardar":
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def list(self, request):
        tenant = self.obtener_tenant()
        reglas = {r.presentacion_id: r for r in ReglaCarga.objects.filter(tenant=tenant)}
        filas = []
        qs = (
            PresentacionProducto.objects.filter(tenant=tenant, estado_presentacion=True, producto__estado_producto=True)
            .select_related("producto__categoria", "unidad_venta")
            .order_by("producto__nombre_producto", "orden", "id")
        )
        from .planificacion import _unidad_texto  # noqa: PLC0415

        for p in qs:
            r = reglas.get(p.id)
            filas.append({
                "presentacion": p.id,
                "producto": p.producto.nombre_producto,
                "categoria": p.producto.categoria.nombre_categoria if p.producto.categoria_id else "",
                "presentacion_nombre": p.nombre_presentacion,
                "unidad": _unidad_texto(p),
                "unidades_por_canastilla": str(r.unidades_por_canastilla) if r and r.unidades_por_canastilla is not None else None,
                "peso_kg_por_unidad": str(r.peso_kg_por_unidad) if r and r.peso_kg_por_unidad is not None else None,
            })
        return Response(filas)

    @action(detail=False, methods=["post"])
    def guardar(self, request):
        tenant = self.obtener_tenant()
        filas = request.data if isinstance(request.data, list) else request.data.get("reglas")
        if not isinstance(filas, list) or len(filas) > 2000:
            raise ValidationError("Envía una lista de reglas.")
        ids = [f.get("presentacion") for f in filas if isinstance(f, dict)]
        presentaciones = set(
            PresentacionProducto.objects.filter(tenant=tenant, id__in=ids).values_list("id", flat=True)
        )
        with transaction.atomic():
            for f in filas:
                pid = f.get("presentacion") if isinstance(f, dict) else None
                if pid not in presentaciones:
                    raise ValidationError("Hay presentaciones que no existen.")
                upc = _decimal_o_nulo(f.get("unidades_por_canastilla"), "unidades por canastilla", 100000)
                peso = _decimal_o_nulo(f.get("peso_kg_por_unidad"), "peso por unidad", 5000)
                if upc is None and peso is None:
                    ReglaCarga.objects.filter(tenant=tenant, presentacion_id=pid).delete()
                    continue
                ReglaCarga.objects.update_or_create(
                    tenant=tenant, presentacion_id=pid,
                    defaults={"unidades_por_canastilla": upc, "peso_kg_por_unidad": peso},
                )
        return self.list(request)


class PlanificacionViewSet(ExigeModuloPlanoCarga, viewsets.ViewSet):
    """
    El centro de planificación diaria.

    GET  `dia/?fecha=AAAA-MM-DD&tipo_canastilla=<id>` → la propuesta del día
         (no guarda nada).
    POST `generar/` {fecha, tipo_canastilla, vehiculos, liberar} → despachos
         en borrador, uno por vehículo, con su acomodo automático. `liberar`:
         pedidos retirados a mano de su vehículo.
    """

    permission_classes = [requiere_permiso(VER)]

    def _tipo(self, valor):
        tenant = self.obtener_tenant()
        qs = TipoCanastilla.objects.filter(tenant=tenant)
        try:
            if valor not in (None, ""):
                return qs.get(pk=int(valor))
        except (TypeError, ValueError, TipoCanastilla.DoesNotExist):
            raise ValidationError("Elige una canastilla válida.")
        tipo = qs.filter(activa=True).first()
        if tipo is None:
            raise ValidationError("Registra primero una canastilla.")
        return tipo

    def _fecha(self, valor) -> datetime.date:
        fecha = _fecha(valor or "")
        if not fecha:
            raise ValidationError("Indica la fecha (AAAA-MM-DD).")
        return fecha

    @action(detail=False, methods=["get"])
    def dia(self, request):
        fecha = self._fecha(request.query_params.get("fecha"))
        tipo = self._tipo(request.query_params.get("tipo_canastilla"))
        return Response(proponer(self.obtener_tenant(), fecha, tipo))

    @action(detail=False, methods=["post"])
    def generar(self, request):
        if not requiere_permiso(ARMAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para armar despachos.")
        fecha = self._fecha(request.data.get("fecha"))
        tipo = self._tipo(request.data.get("tipo_canastilla"))
        tenant = self.obtener_tenant()
        contexto = {"request": request, "tenant": tenant, "view": self}
        planos = generar(
            tenant, fecha, tipo, request.data.get("vehiculos"), request.user, contexto,
            liberar=request.data.get("liberar") or [],
        )
        return Response(
            {
                "despachos": PlanoCargaListaSerializer(planos, many=True, context=contexto).data,
                "propuesta": proponer(tenant, fecha, tipo),
            },
            status=201,
        )
