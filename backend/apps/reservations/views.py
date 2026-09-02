"""
Las rutas de la agenda.

Todas del panel del negocio, todas detrás de un permiso, y todas detrás del
mismo guardia que la caja: el módulo tiene que estar contratado Y encendido. La
comprobación se hace una vez por petición en `initial()` y no vista por vista,
por lo mismo que en el POS: repartir esa condición es garantizar que alguien la
olvide en la ruta que menos se mira.
"""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.business.aplicar import modulos_activos
from apps.common.permissions import requiere_permiso
from apps.pos.models import Venta
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from . import operaciones as reservas
from .models import Recurso, Reserva
from .paneles import MODULO
from .serializers import (
    AgendaSerializer,
    CambiarEstadoSerializer,
    ConfiguracionSerializer,
    CrearReservaSerializer,
    RecursoSerializer,
    ReprogramarSerializer,
    ReservaSerializer,
)

VER = "reservations.view_reserva"
RESERVAR = "reservations.add_reserva"
ADMINISTRAR = "reservations.change_recurso"


class ExigeModuloReservas(ExigeNegocioMixin):
    """
    El módulo tiene que estar contratado y encendido.

    Copiado a propósito del POS en vez de sacado a una clase común: son cinco
    líneas, y una base compartida entre módulos es justo la costura por la que
    un sistema modular se vuelve un sistema acoplado. El día que haya cuatro
    módulos con este guardia se extrae — con cuatro ejemplos delante, no con
    dos supuestos.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if MODULO not in modulos_activos(self.obtener_tenant()):
            raise PermissionDenied("Las reservas no están activas en este negocio.")


class ConfiguracionReservasView(ExigeModuloReservas, APIView):
    """
    Cómo llama este negocio a lo que reserva, y cuánto dura.

    Es lo primero que pide la pantalla: sin esto no sabe si titularse «Mesas» o
    «Canchas», y poner «Recursos» mientras carga sería enseñarle al usuario la
    palabra del programador.
    """

    permission_classes = [requiere_permiso(VER)]

    def get(self, request):
        return Response(
            ConfiguracionSerializer(reservas.configuracion(self.obtener_tenant())).data
        )

    def put(self, request):
        if not requiere_permiso(ADMINISTRAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para configurar las reservas.")

        config = reservas.configuracion(self.obtener_tenant())
        entrada = ConfiguracionSerializer(config, data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data)


class RecursoViewSet(ExigeModuloReservas, TenantScopedMixin, viewsets.ModelViewSet):
    """Las mesas, sillas o canchas del negocio."""

    serializer_class = RecursoSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Recurso
    # Catálogo cerrado y corto que alimenta los <select> y el plano de la
    # agenda: paginarlo solo haría desaparecer la mesa número veintiuno.
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def get_queryset(self):
        return super().get_queryset().select_related("ubicacion")


class ReservaViewSet(ExigeModuloReservas, TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    Las reservas: se leen como recurso, se cambian con operaciones con nombre.

    No hay `PATCH`. Mover una reserva vuelve a disputar un hueco y tiene que
    pasar por el bloqueo del recurso; un campo editable se lo saltaría y
    dejaría dos reservas encimadas sin que nadie hubiera creado ninguna de más.
    """

    serializer_class = ReservaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Reserva
    filterset_fields = ["recurso", "estado", "cliente"]
    search_fields = ["nombre_contacto", "telefono_contacto"]

    def get_queryset(self):
        return super().get_queryset().select_related("recurso", "cliente")

    def _responder(self, operacion, exito=status.HTTP_200_OK):
        try:
            reserva = operacion()
        except reservas.ErrorDeReserva as error:
            # Quedarse sin mesa es una respuesta normal, no un fallo del
            # servidor: sale como 400 con el mensaje escrito para quien atiende.
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ReservaSerializer(reserva).data, status=exito)

    @action(detail=False, methods=["get"])
    def agenda(self, request):
        """Lo que hay entre dos momentos. Es la consulta que pinta la pantalla."""
        entrada = AgendaSerializer(
            data=request.query_params, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        encontradas = reservas.agenda(
            self.obtener_tenant(),
            entrada.validated_data["desde"],
            entrada.validated_data["hasta"],
            recurso=entrada.validated_data.get("recurso"),
        )
        return Response(ReservaSerializer(encontradas, many=True).data)

    @action(detail=False, methods=["get"])
    def libres(self, request):
        """Qué recursos admiten una reserva más en ese hueco."""
        entrada = AgendaSerializer(
            data=request.query_params, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        recursos = reservas.libres(
            self.obtener_tenant(),
            entrada.validated_data["desde"],
            entrada.validated_data["hasta"],
        )
        return Response(RecursoSerializer(recursos, many=True).data)

    @action(detail=False, methods=["post"])
    def crear(self, request):
        if not requiere_permiso(RESERVAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para crear reservas.")

        entrada = CrearReservaSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        return self._responder(
            lambda: reservas.crear(
                self.obtener_tenant(),
                recurso=datos["recurso"],
                inicio=datos["inicio"],
                fin=datos.get("fin"),
                personas=datos["personas"],
                nombre_contacto=datos["nombre_contacto"],
                telefono_contacto=datos["telefono_contacto"],
                cliente=datos.get("cliente"),
                nota=datos["nota"],
                origen=Reserva.Origen.PANEL,
                usuario=request.user,
            ),
            exito=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def reprogramar(self, request, pk=None):
        if not requiere_permiso(RESERVAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para mover reservas.")

        entrada = ReprogramarSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        reserva = self.get_object()
        return self._responder(
            lambda: reservas.reprogramar(
                reserva,
                inicio=datos.get("inicio"),
                fin=datos.get("fin"),
                recurso=datos.get("recurso"),
                personas=datos.get("personas"),
            )
        )

    @action(detail=True, methods=["post"], url_path="estado")
    def cambiar_estado(self, request, pk=None):
        entrada = CambiarEstadoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        reserva = self.get_object()
        return self._responder(
            lambda: reservas.cambiar_estado(
                reserva,
                entrada.validated_data["estado"],
                nota=entrada.validated_data.get("nota"),
            )
        )

    @action(detail=True, methods=["post"], url_path="enlazar-venta")
    def enlazar_venta(self, request, pk=None):
        """
        Cuelga de la reserva la venta que la atendió.

        La llama el panel de la caja después de abrir la venta. Va en esta
        dirección —de reserva a venta, y desde este módulo— para que el POS
        siga sin saber que las reservas existen: él solo guardó un diccionario
        opaco en `Venta.contexto`.
        """
        venta = Venta.objects.filter(pk=request.data.get("venta_id")).first()
        if venta is None:
            return Response(
                {"detail": "Esa venta no existe."}, status=status.HTTP_400_BAD_REQUEST
            )
        reserva = self.get_object()
        return self._responder(lambda: reservas.enlazar_venta(reserva, venta))
