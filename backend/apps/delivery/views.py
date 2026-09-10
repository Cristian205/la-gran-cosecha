"""
Las rutas del despacho.

Todas del panel del negocio, todas detrás de un permiso, y todas detrás del
mismo guardia que la caja y la agenda: el módulo tiene que estar contratado Y
encendido. La comprobación se hace una vez por petición en `initial()` y no
vista por vista, por lo mismo que en los otros dos: repartir esa condición es
garantizar que alguien la olvide en la ruta que menos se mira.
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

from . import operaciones as domicilios
from .models import Envio, Repartidor, Zona
from .paneles import MODULO
from .serializers import (
    AsignarSerializer,
    CambiarEstadoSerializer,
    ConfiguracionSerializer,
    CrearEnvioSerializer,
    EnvioSerializer,
    RepartidorSerializer,
    TableroSerializer,
    ZonaSerializer,
)

VER = "delivery.view_envio"
DESPACHAR = "delivery.add_envio"
ADMINISTRAR = "delivery.change_zona"


class ExigeModuloDomicilios(ExigeNegocioMixin):
    """
    El módulo tiene que estar contratado y encendido.

    Tercera copia de estas cinco líneas —POS, reservas y esto—. La de reservas
    dejó dicho que se extraería «el día que haya cuatro módulos con este
    guardia, con cuatro ejemplos delante y no con dos supuestos». Vamos por
    tres, así que se sigue copiando: una base compartida entre módulos es justo
    la costura por la que un sistema modular se vuelve un sistema acoplado, y
    lo que se ahorraría son cinco líneas.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if MODULO not in modulos_activos(self.obtener_tenant()):
            raise PermissionDenied("Los domicilios no están activos en este negocio.")


class ConfiguracionEnviosView(ExigeModuloDomicilios, APIView):
    """
    Cómo llama este negocio a quien reparte, y cuánto cobra por llegar.

    Es lo primero que pide la pantalla: sin esto no sabe si titularse
    «Domiciliarios» o «Mensajeros», y poner «Repartidores» mientras carga sería
    enseñarle al usuario la palabra del programador.
    """

    permission_classes = [requiere_permiso(VER)]

    def get(self, request):
        return Response(
            ConfiguracionSerializer(
                domicilios.configuracion(self.obtener_tenant())
            ).data
        )

    def put(self, request):
        if not requiere_permiso(ADMINISTRAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para configurar los domicilios.")

        config = domicilios.configuracion(self.obtener_tenant())
        entrada = ConfiguracionSerializer(config, data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data)


class ZonaViewSet(ExigeModuloDomicilios, TenantScopedMixin, viewsets.ModelViewSet):
    """Los barrios a los que este negocio llega, con su precio."""

    serializer_class = ZonaSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Zona
    # Catálogo cerrado y corto que alimenta un <select>: paginarlo solo haría
    # desaparecer la zona número veintiuno.
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()


class RepartidorViewSet(
    ExigeModuloDomicilios, TenantScopedMixin, viewsets.ModelViewSet
):
    """Quiénes reparten, y cuánto les cabe."""

    serializer_class = RepartidorSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Repartidor
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [requiere_permiso(ADMINISTRAR)()]
        return super().get_permissions()

    def get_queryset(self):
        # `carga_actual` cuenta sobre esto. Sin el prefetch sería una consulta
        # por repartidor, que con cuatro no duele y con cuarenta sí.
        return super().get_queryset().prefetch_related("envios")

    @action(detail=False, methods=["get"])
    def disponibles(self, request):
        """A quiénes todavía les cabe algo. Es la lista del desplegable de asignar."""
        libres = domicilios.disponibles(self.obtener_tenant())
        return Response(RepartidorSerializer(libres, many=True).data)


class EnvioViewSet(ExigeModuloDomicilios, TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """
    Los envíos: se leen como recurso, se cambian con operaciones con nombre.

    No hay `PATCH`. Asignar un envío obliga a contar lo que el repartidor ya
    lleva, y eso pasa por un bloqueo de su fila; un campo editable se lo
    saltaría y le colgaría dos envíos de más sin que nadie hubiera creado
    ninguno.
    """

    serializer_class = EnvioSerializer
    permission_classes = [requiere_permiso(VER)]
    modelo = Envio
    filterset_fields = ["estado", "zona", "repartidor", "cliente"]
    search_fields = ["nombre_contacto", "telefono_contacto", "direccion"]

    def get_queryset(self):
        return super().get_queryset().select_related("zona", "repartidor", "cliente")

    def _responder(self, operacion, exito=status.HTTP_200_OK):
        try:
            envio = operacion()
        except domicilios.ErrorDeEnvio as error:
            # Quedarse sin repartidor o estar fuera de cobertura son respuestas
            # normales, no fallos del servidor: salen como 400 con el mensaje
            # escrito para quien despacha.
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(EnvioSerializer(envio).data, status=exito)

    @action(detail=False, methods=["get"])
    def tablero(self, request):
        """Lo que hay que despachar. Es la consulta que pinta la pantalla."""
        entrada = TableroSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        encontrados = domicilios.tablero(
            self.obtener_tenant(),
            desde=entrada.validated_data.get("desde"),
            hasta=entrada.validated_data.get("hasta"),
            estados=entrada.validated_data.get("estado"),
        )
        return Response(EnvioSerializer(encontrados, many=True).data)

    @action(detail=False, methods=["post"])
    def crear(self, request):
        if not requiere_permiso(DESPACHAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para crear domicilios.")

        entrada = CrearEnvioSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        # De dónde viene el envío se deduce de lo que trae, no se pregunta: si
        # llega con una venta es del mostrador, si llega con un pedido es de la
        # tienda. Dejar que el cliente HTTP declarara su propio origen haría
        # que el histórico dijera lo que a cada quien le convino.
        venta = None
        if request.data.get("venta_id"):
            venta = Venta.objects.filter(pk=request.data["venta_id"]).first()

        pedido = datos.get("pedido")
        origen = (
            Envio.Origen.CAJA
            if venta is not None
            else Envio.Origen.TIENDA
            if pedido is not None
            else Envio.Origen.PANEL
        )

        # La dirección de un pedido de la tienda se COPIA de la ficha del
        # cliente aquí, y no se lee después por la clave foránea: ver el
        # docstring de `Envio`.
        cliente = datos.get("cliente") or getattr(pedido, "cliente", None)
        direccion = datos["direccion"] or getattr(cliente, "direccion_cliente", "")

        return self._responder(
            lambda: domicilios.crear(
                self.obtener_tenant(),
                direccion=direccion,
                zona=datos.get("zona"),
                nombre_contacto=datos["nombre_contacto"],
                telefono_contacto=datos["telefono_contacto"],
                referencia=datos["referencia"],
                cliente=cliente,
                tarifa=datos.get("tarifa"),
                cobro_contra_entrega=datos["cobro_contra_entrega"],
                monto_a_cobrar=datos.get("monto_a_cobrar") or 0,
                nota=datos["nota"],
                origen=origen,
                usuario=request.user,
                venta=venta,
                pedido=pedido,
            ),
            exito=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def asignar(self, request, pk=None):
        if not requiere_permiso(DESPACHAR)().has_permission(request, self):
            raise PermissionDenied("No tienes permiso para asignar domicilios.")

        entrada = AsignarSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        entrada.is_valid(raise_exception=True)
        envio = self.get_object()
        return self._responder(
            lambda: domicilios.asignar(envio, entrada.validated_data["repartidor"])
        )

    @action(detail=True, methods=["post"], url_path="estado")
    def cambiar_estado(self, request, pk=None):
        entrada = CambiarEstadoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        envio = self.get_object()
        return self._responder(
            lambda: domicilios.cambiar_estado(
                envio,
                entrada.validated_data["estado"],
                nota=entrada.validated_data.get("nota"),
            )
        )

    @action(detail=True, methods=["post"], url_path="enlazar-venta")
    def enlazar_venta(self, request, pk=None):
        """
        Cuelga del envío la venta que lo pagó.

        Existe para el caso en que la venta se abre DESPUÉS del envío —el
        pedido entró por la tienda y se cobra al volver el repartidor—. Cuando
        pasa al revés, el panel de la caja ya crea el envío con su `venta_id`.
        """
        venta = Venta.objects.filter(pk=request.data.get("venta_id")).first()
        if venta is None:
            return Response(
                {"detail": "Esa venta no existe."}, status=status.HTTP_400_BAD_REQUEST
            )
        envio = self.get_object()
        return self._responder(lambda: domicilios.enlazar_venta(envio, venta))
