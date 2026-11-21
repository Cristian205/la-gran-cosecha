"""
Las rutas de los lotes de despacho.

Un lote se crea desde la tabla de pedidos (`elegibles/` dice cuáles se pueden
planificar y para qué fecha) y a partir de ahí todo ocurre en una sola
pantalla: ver el reparto, corregirlo, generar los planos de carga, revisar el
resumen, confirmar y bajar la documentación.

Mismo guardia que el resto del plano de carga (`ExigeModuloPlanoCarga`).
Permisos: mirar = ver planos; crear, corregir, generar y confirmar = armar
despachos.
"""
from django.db.models import Prefetch
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.common.permissions import requiere_permiso
from apps.content.models import StoreSettings
from apps.orders.models import Pedido

from . import lotes as motor
from .lote_pdf import DOCUMENTOS, ETIQUETAS, html_relacion, unir
from .models import EventoLote, LoteDespacho, PlanoCarga, TipoCanastilla
from .plano_pdf import html_plano
from .views import ARMAR, VER, ExigeModuloPlanoCarga, _fecha


class LoteDespachoViewSet(ExigeModuloPlanoCarga, viewsets.ViewSet):
    """
    Lotes de despacho: la preparación del despacho de un día.

    GET    `/`                      los lotes (`?fecha=`, `?estado=`).
    POST   `/`                      {fecha, pedidos, tipo_canastilla, nombre} → lote con su reparto.
    GET    `elegibles/`             pedidos planificables (`?fecha=` para el detalle del día).
    GET    `<id>/`                  el lote con vehículos, paradas, productos y bitácora.
    PATCH  `<id>/`                  {nombre, notas}.
    PUT    `<id>/distribucion/`     el reparto corregido a mano.
    POST   `<id>/redistribuir/`     vuelve a calcular el reparto automático.
    POST   `<id>/pedidos/`          {agregar: [], quitar: []}.
    POST   `<id>/generar/`          un plano de carga por vehículo.
    GET    `<id>/resumen/`          lo que se revisa antes de confirmar.
    POST   `<id>/confirmar/`        confirma el lote y congela sus datos.
    POST   `<id>/estado/`           {estado} → EN_RUTA, ENTREGADO o reabrir.
    POST   `<id>/anular/`           {motivo}.
    GET    `<id>/pdf/`              `?doc=planos|productos|facturas|todo`.
    """

    permission_classes = [requiere_permiso(VER)]

    # ---------------------------------------------------------------- ayudas
    def _armar(self):
        if not requiere_permiso(ARMAR)().has_permission(self.request, self):
            raise PermissionDenied("No tienes permiso para armar despachos.")

    def _lote(self, pk) -> LoteDespacho:
        try:
            return (
                LoteDespacho.objects.filter(tenant=self.obtener_tenant())
                .select_related("tipo_canastilla", "creado_por", "confirmado_por")
                .get(pk=int(pk))
            )
        except (TypeError, ValueError, LoteDespacho.DoesNotExist):
            raise NotFound("Ese lote no existe.")

    def _tipo(self, valor):
        qs = TipoCanastilla.objects.filter(tenant=self.obtener_tenant())
        try:
            if valor not in (None, ""):
                return qs.get(pk=int(valor))
        except (TypeError, ValueError, TipoCanastilla.DoesNotExist):
            raise ValidationError("Elige una canastilla válida.")
        tipo = qs.filter(activa=True).first()
        if tipo is None:
            raise ValidationError("Registra primero una canastilla.")
        return tipo

    def _vista(self, lote: LoteDespacho) -> dict:
        return {**motor.hidratar(lote), "eventos": motor.eventos(lote)}

    # ---------------------------------------------------------------- lectura
    def list(self, request):
        estado = request.query_params.get("estado") or ""
        estados = [e for e in estado.split(",") if e in dict(LoteDespacho.ESTADOS)]
        return Response(
            motor.lista(self.obtener_tenant(), _fecha(request.query_params.get("fecha", "")), estados)
        )

    def retrieve(self, request, pk=None):
        return Response(self._vista(self._lote(pk)))

    @action(detail=False, methods=["get"])
    def elegibles(self, request):
        """
        Los pedidos que todavía se pueden planificar. Sin `fecha` devuelve solo
        las fechas de entrega con su conteo (para elegir el día); con `fecha`,
        los pedidos de ese día con sus productos y canastillas estimadas.
        """
        return Response(
            motor.elegibles(self.obtener_tenant(), _fecha(request.query_params.get("fecha", "")))
        )

    @action(detail=True, methods=["get"])
    def resumen(self, request, pk=None):
        return Response(motor.resumen(self._lote(pk)))

    # ---------------------------------------------------------------- escritura
    def create(self, request):
        self._armar()
        fecha = _fecha(request.data.get("fecha") or "")
        if not fecha:
            raise ValidationError("Indica la fecha de entrega (AAAA-MM-DD).")
        lote = motor.crear(
            self.obtener_tenant(), fecha, request.data.get("pedidos"),
            self._tipo(request.data.get("tipo_canastilla")), request.user,
            nombre=request.data.get("nombre") or "",
        )
        return Response(self._vista(lote), status=201)

    def partial_update(self, request, pk=None):
        self._armar()
        lote = self._lote(pk)
        campos = []
        if "nombre" in request.data:
            lote.nombre = str(request.data.get("nombre") or "").strip()[:120]
            campos.append("nombre")
        if "notas" in request.data:
            lote.notas = str(request.data.get("notas") or "")[:2000]
            campos.append("notas")
        if campos:
            lote.save(update_fields=[*campos, "actualizado"])
        return Response(self._vista(lote))

    @action(detail=True, methods=["put", "patch"])
    def distribucion(self, request, pk=None):
        self._armar()
        lote = motor.guardar_distribucion(self._lote(pk), request.data, request.user)
        return Response(self._vista(lote))

    @action(detail=True, methods=["post"])
    def redistribuir(self, request, pk=None):
        self._armar()
        return Response(self._vista(motor.redistribuir(self._lote(pk), request.user)))

    @action(detail=True, methods=["post"])
    def pedidos(self, request, pk=None):
        """Agrega o quita pedidos del lote sin rehacer el reparto."""
        self._armar()
        lote = self._lote(pk)
        agregar = request.data.get("agregar") or []
        quitar = request.data.get("quitar") or []
        if not agregar and not quitar:
            raise ValidationError("Indica qué pedidos agregar o quitar.")
        if agregar:
            lote = motor.agregar_pedidos(lote, agregar, request.user)
        if quitar:
            lote = motor.quitar_pedidos(lote, quitar, request.user)
        return Response(self._vista(lote))

    @action(detail=True, methods=["post"])
    def generar(self, request, pk=None):
        self._armar()
        lote = self._lote(pk)
        contexto = {"request": request, "tenant": lote.tenant, "view": self}
        motor.generar(lote, request.user, contexto)
        return Response(self._vista(self._lote(pk)), status=201)

    @action(detail=True, methods=["post"])
    def confirmar(self, request, pk=None):
        self._armar()
        lote = self._lote(pk)
        motor.confirmar(lote, request.user)
        return Response(self._vista(self._lote(pk)))

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        self._armar()
        nuevo = str(request.data.get("estado") or "").upper()
        if nuevo not in dict(LoteDespacho.ESTADOS):
            raise ValidationError("Ese estado no existe.")
        lote = motor.cambiar_estado(self._lote(pk), nuevo, request.user)
        return Response(self._vista(lote))

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        self._armar()
        lote = motor.anular(self._lote(pk), request.user, str(request.data.get("motivo") or "")[:300])
        return Response(self._vista(lote))

    # ---------------------------------------------------------------- documentos
    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """
        La documentación del lote. `?doc=planos|productos|facturas|todo`
        (por omisión, todo) y `?formato=html` para ver la relación de
        productos en el navegador.
        """
        lote = self._lote(pk)
        doc = (request.query_params.get("doc") or "todo").lower()
        if doc not in (*DOCUMENTOS, "todo"):
            raise ValidationError("El documento pedido no existe.")
        vista = motor.hidratar(lote)
        config = StoreSettings.get_para(lote.tenant)
        negocio = (config.nombre_empresa if config else "") or ""
        planos = list(
            PlanoCarga.objects.filter(tenant=lote.tenant, lote=lote)
            .select_related("furgon", "tipo_canastilla", "ruta", "lote")
            .prefetch_related(Prefetch("pedidos"))
            .order_by("id")
        )
        pedidos = list(
            Pedido.objects.filter(
                tenant=lote.tenant,
                id__in=[
                    p["id"] for v in vista["vehiculos"] for par in v["paradas"] for p in par["pedidos"]
                ],
            ).select_related("cliente").order_by("id")
        )

        partes = []
        if doc in ("planos", "todo"):
            if not planos and doc == "planos":
                raise ValidationError("Todavía no hay planos de carga: genera los despachos.")
            for plano in planos:
                congelados = plano.datos_operativos if plano.estado == PlanoCarga.CONFIRMADO else None
                from .planificacion import datos_operativos  # noqa: PLC0415 — import circular

                datos = congelados if congelados and "paradas" in congelados else datos_operativos(plano)
                partes.append(html_plano(plano, negocio, datos))
        if doc in ("productos", "todo"):
            partes.append(html_relacion(lote, vista, negocio))
        if doc in ("facturas", "todo"):
            if not pedidos and doc == "facturas":
                raise ValidationError("El lote no tiene pedidos asignados a un vehículo.")
            if pedidos:
                from apps.orders.pdf import html_facturas  # noqa: PLC0415 — weasyprint pesa

                partes.append(html_facturas(pedidos))
        if not partes:
            raise ValidationError("No hay nada que imprimir todavía.")

        if request.query_params.get("formato") == "html":
            return HttpResponse(partes[-1 if doc == "productos" else 0], content_type="text/html; charset=utf-8")

        respuesta = HttpResponse(content_type="application/pdf")
        nombre = f"lote-{lote.numero}-{lote.fecha:%Y%m%d}-{doc}.pdf"
        respuesta["Content-Disposition"] = f'inline; filename="{nombre}"'
        unir(partes, respuesta, base_url=request.build_absolute_uri())
        motor.anotar(
            lote, EventoLote.DOCUMENTO, f"Se generó «{ETIQUETAS[doc]}».", request.user, {"doc": doc}
        )
        return respuesta

