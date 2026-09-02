"""
Las rutas de la caja.

Todas del panel del negocio, y todas detrás de un permiso propio: vender es una
capacidad distinta de administrar el catálogo, y en un mostrador la reparte
gente distinta.

Además del permiso, hay un guardia que las demás apps no necesitan: el módulo
POS tiene que estar contratado Y encendido. Se comprueba en `initial()`, una
vez por petición, y no en cada vista: repartir esa condición es garantizar que
alguien la olvide en la que menos se mira.
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.business.aplicar import modulos_activos
from apps.business.consulta import perfil_pos
from apps.common.permissions import requiere_permiso
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from . import operaciones as caja
from . import paneles
from .aspecto import aspecto
from .models import MedioPago, Turno, Venta
from .serializers import (
    AbrirTurnoSerializer,
    AbrirVentaSerializer,
    AgregarLineaSerializer,
    AnularSerializer,
    CerrarTurnoSerializer,
    CobrarSerializer,
    MedioPagoSerializer,
    TurnoSerializer,
    VentaSerializer,
)

VENDER = "pos.add_venta"
ADMINISTRAR = "pos.change_turno"

#: El slug del módulo en el catálogo comercial. Si no está contratado y
#: encendido, la caja no existe para este negocio.
MODULO = "pos"


class ExigeModuloPOS(ExigeNegocioMixin):
    """
    El módulo tiene que estar contratado y encendido.

    Son dos preguntas distintas y las dos se responden en `modulos_activos`: el
    plan dice si puede, `TenantModulo` si lo quiere. Un 403 y no un 404 porque
    la ruta existe de verdad; lo que falta es la contratación, y decirlo es la
    conversación comercial.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if MODULO not in modulos_activos(self.obtener_tenant()):
            raise PermissionDenied(
                "El punto de venta no está activo en este negocio."
            )


class ConfiguracionPOSView(ExigeModuloPOS, APIView):
    """
    Lo que la caja necesita saber antes de pintarse.

    Va todo en una respuesta —perfil, aspecto, turno abierto, medios de pago,
    paneles— porque el POS se abre al empezar la jornada y cada petición extra
    es un segundo delante de un cliente esperando.
    """

    permission_classes = [requiere_permiso(VENDER)]

    def get(self, request):
        tenant = self.obtener_tenant()
        turno = caja.turno_abierto(tenant)
        return Response(
            {
                "perfil_pos": perfil_pos(tenant),
                # Cómo SE VE, frente a `perfil_pos`, que es qué HACE. Sale del
                # tema del negocio: la caja de una boutique es rosa y espaciada
                # y la de una ferretería gris y apretada, sin una sola rama
                # aquí dentro. Ver `pos/aspecto.py`.
                "aspecto": aspecto(tenant),
                "turno": TurnoSerializer(turno).data if turno else None,
                "medios_pago": MedioPagoSerializer(
                    MedioPago.objects.filter(activo=True), many=True
                ).data,
                # Los paneles que este negocio puede usar, ya filtrados por lo
                # que tiene contratado. Ver `pos/paneles.py`.
                "paneles": [
                    {
                        "clave": p.clave,
                        "nombre": p.nombre,
                        "descripcion": p.descripcion,
                    }
                    for p in paneles.disponibles(modulos_activos(tenant))
                ],
            }
        )


class TurnoViewSet(ExigeModuloPOS, TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Los turnos de caja: se abren y se cierran, no se editan."""

    serializer_class = TurnoSerializer
    permission_classes = [requiere_permiso(VENDER)]
    modelo = Turno

    def get_queryset(self):
        return super().get_queryset().select_related("ubicacion", "usuario_apertura")

    @action(detail=False, methods=["post"])
    def abrir(self, request):
        entrada = AbrirTurnoSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        try:
            turno = caja.abrir_turno(
                self.obtener_tenant(),
                request.user,
                ubicacion=entrada.validated_data.get("ubicacion"),
                fondo_inicial=entrada.validated_data.get("fondo_inicial") or 0,
            )
        except caja.ErrorDeCaja as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TurnoSerializer(turno).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        # Cerrar caja es un acto de responsabilidad —deja constancia de un
        # descuadre con nombre y apellidos—, así que pide más que vender.
        if not requiere_permiso(ADMINISTRAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para cerrar la caja.")

        entrada = CerrarTurnoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            turno = caja.cerrar_turno(
                self.get_object(),
                request.user,
                total_declarado=entrada.validated_data["total_declarado"],
                nota=entrada.validated_data.get("nota", ""),
            )
        except caja.ErrorDeCaja as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TurnoSerializer(turno).data)

    @action(detail=True, methods=["get"])
    def arqueo(self, request, pk=None):
        """Cuánto debería haber en el cajón, antes de contarlo."""
        turno = self.get_object()
        return Response(
            {
                "fondo_inicial": turno.fondo_inicial,
                "efectivo_esperado": caja.efectivo_esperado(turno),
                "ventas": turno.ventas.filter(estado=Venta.Estado.PAGADA).count(),
            }
        )


class VentaViewSet(ExigeModuloPOS, TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    Las ventas.

    Solo lectura como recurso, con acciones para todo lo demás. Cobrar no es
    escribir un campo: es registrar pagos y mover inventario en la misma
    transacción, y un `PATCH {"estado": "PAGADA"}` sugeriría lo contrario.
    """

    serializer_class = VentaSerializer
    permission_classes = [requiere_permiso(VENDER)]
    modelo = Venta
    filterset_fields = ["turno", "estado"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related("cliente", "turno")
            .prefetch_related("lineas", "pagos__medio")
        )

    def _responder(self, operacion):
        try:
            venta = operacion()
        except caja.ErrorDeCaja as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as error:  # noqa: BLE001
            # Lo que llega aquí es casi siempre `StockInsuficiente`, que viene
            # de inventario y trae un mensaje escrito para un cajero. Se
            # traduce a 400 en vez de dejarlo salir como 500: quedarse sin
            # mercancía es una respuesta normal, no un fallo del servidor.
            from apps.inventory.operaciones import ErrorDeInventario  # noqa: PLC0415

            if isinstance(error, ErrorDeInventario):
                return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
            raise
        return Response(VentaSerializer(venta).data)

    @action(detail=False, methods=["post"])
    def abrir(self, request):
        tenant = self.obtener_tenant()
        turno = caja.turno_abierto(tenant)
        if turno is None:
            return Response(
                {"detail": "No hay ninguna caja abierta. Abre un turno para vender."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entrada = AbrirVentaSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        venta = caja.abrir_venta(
            turno,
            request.user,
            cliente=entrada.validated_data.get("cliente"),
            contexto=entrada.validated_data.get("contexto"),
        )
        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="lineas")
    def agregar_linea(self, request, pk=None):
        entrada = AgregarLineaSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        venta = self.get_object()
        return self._responder(
            lambda: (
                caja.agregar_linea(
                    venta,
                    entrada.validated_data["presentacion"],
                    entrada.validated_data["cantidad"],
                    nota=entrada.validated_data.get("nota", ""),
                    atributos=entrada.validated_data.get("atributos"),
                ),
                venta,
            )[1]
        )

    @action(detail=True, methods=["delete"], url_path=r"lineas/(?P<linea_id>\d+)")
    def quitar_linea(self, request, pk=None, linea_id=None):
        venta = self.get_object()
        linea = venta.lineas.filter(pk=linea_id).first()
        if linea is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return self._responder(lambda: caja.quitar_linea(linea))

    @action(detail=True, methods=["post"])
    def cobrar(self, request, pk=None):
        entrada = CobrarSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        venta = self.get_object()

        descuento = entrada.validated_data.get("descuento") or 0
        if descuento:
            venta.descuento = descuento
            venta.save(update_fields=["descuento"])

        pagos = [
            (p["medio"], p["importe"], p.get("referencia", ""))
            for p in entrada.validated_data["pagos"]
        ]
        return self._responder(lambda: caja.cobrar(venta, pagos, usuario=request.user))

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        entrada = AnularSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        venta = self.get_object()
        return self._responder(
            lambda: caja.anular(
                venta, request.user, motivo=entrada.validated_data.get("motivo", "")
            )
        )


class MedioPagoViewSet(ExigeModuloPOS, TenantScopedMixin, viewsets.ModelViewSet):
    """Con qué cobra este negocio. Cada uno da de alta los suyos."""

    serializer_class = MedioPagoSerializer
    permission_classes = [requiere_permiso(ADMINISTRAR)]
    modelo = MedioPago
    pagination_class = None
