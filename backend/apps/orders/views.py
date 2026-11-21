from django.db import transaction
from django.db.models import Count, ProtectedError, Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Producto
from apps.catalog.serializers import ProductoSerializer, ProductoWriteSerializer
from apps.common.permissions import EsStaff, requiere_permiso
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from .auditoria import linea_de_tiempo
from .auditoria import registrar as registrar_evento
from .inventario import despachar_pedido
from .models import Cliente, DetallePedido, HistorialDetallePedido, LotePedidos, Pedido
from .serializers import reservar_o_400
from .serializers import (
    ClienteSerializer,
    CrearPedidoSerializer,
    EditarPedidoSerializer,
    HistorialDetallePedidoSerializer,
    LoteDetailSerializer,
    LoteSerializer,
    PedidoDetailSerializer,
    PedidoListSerializer,
    ProductoPendienteSerializer,
    RegistrarPedidoSerializer,
)

MINIMO_MAS_VENDIDOS = 8


class ProductosMasVendidosView(ExigeNegocioMixin, APIView):
    """
    Home público: ranking real por unidades vendidas en pedidos ya
    entregados. Si el negocio es nuevo y aún no hay suficiente historial,
    completa el resto con productos activos por orden de catálogo, para que
    el bloque nunca se vea vacío.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        ids_vendidos = list(
            DetallePedido.objects.filter(
                pedido__estado="ENTREGADO", presentacion__isnull=False
            )
            .values("presentacion__producto_id")
            .annotate(total_cantidad=Sum("cantidad"))
            .order_by("-total_cantidad")
            .values_list("presentacion__producto_id", flat=True)
        )[:MINIMO_MAS_VENDIDOS]

        productos_por_id = Producto.objects.filter(
            id__in=ids_vendidos, estado_producto=True
        ).select_related("categoria").prefetch_related("presentaciones__unidad_venta")
        productos_por_id = {p.id: p for p in productos_por_id}
        resultado = [productos_por_id[i] for i in ids_vendidos if i in productos_por_id]

        if len(resultado) < MINIMO_MAS_VENDIDOS:
            faltan = MINIMO_MAS_VENDIDOS - len(resultado)
            relleno = (
                Producto.objects.filter(estado_producto=True)
                .exclude(id__in=[p.id for p in resultado])
                .select_related("categoria")
                .prefetch_related("presentaciones__unidad_venta")
                .order_by("orden", "nombre_producto")[:faltan]
            )
            resultado += list(relleno)

        data = ProductoSerializer(resultado, many=True, context={"request": request}).data
        # Cuáles salen del ranking y cuáles del relleno. Sin esto la tienda no
        # puede distinguirlos y pondría "Más pedido" sobre un producto que solo
        # está aquí porque el negocio aún no tiene historial — una etiqueta
        # que miente. Es un booleano: el volumen vendido no se publica.
        con_ventas = set(ids_vendidos)
        for item in data:
            item["por_ventas"] = item["id"] in con_ventas
        return Response(data)


class PedidoViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """
    Pedidos.
    - create: público (el cliente genera su pedido desde el storefront).
    - resto de operaciones: solo staff.
    """

    search_fields = ["id", "cliente__nombre_cliente"]
    ordering_fields = ["id", "fecha_pedido", "total_pedido"]
    ordering = ["-id"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        if self.action == "registrar":
            return [requiere_permiso("orders.add_pedido")()]
        if self.action in ("update", "partial_update", "entregar"):
            return [requiere_permiso("orders.change_pedido")()]
        if self.action in ("destroy", "eliminar"):
            return [requiere_permiso("orders.delete_pedido")()]
        return [requiere_permiso("orders.view_pedido")()]

    def get_queryset(self):
        qs = (
            Pedido.objects.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-id")
        )
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        desde = self.request.query_params.get("desde")
        if desde:
            qs = qs.filter(fecha_pedido__date__gte=desde)
        hasta = self.request.query_params.get("hasta")
        if hasta:
            qs = qs.filter(fecha_pedido__date__lte=hasta)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return CrearPedidoSerializer
        if self.action in ("retrieve", "partial_update", "update"):
            return PedidoDetailSerializer
        return PedidoListSerializer

    def list(self, request, *args, **kwargs):
        """
        La lista de siempre, más en qué punto va cada pedido. Son dos cosas
        distintas y van en dos campos distintos:

        * `comercial` — qué pasó con el PEDIDO: por revisar, recibido,
          impreso (`estado_comercial.py`).
        * `logistica` — dónde va la CARGA: pendiente de planificación, en un
          lote, con plano de carga, confirmada, en ruta, entregada
          (`apps.logistica.lotes`). Solo si el negocio tiene el plano de
          carga; sin ese módulo no se añade.

        Las dos se DEDUCEN de hechos ya registrados —la factura generada, el
        producto sugerido sin aprobar, el lote que reservó el pedido— y se
        resuelven aquí para la página que se devuelve, en unas pocas
        consultas y no una por fila.
        """
        respuesta = super().list(request, *args, **kwargs)
        datos = respuesta.data
        filas = datos.get("results") if isinstance(datos, dict) else datos
        if not isinstance(filas, list) or not filas:
            return respuesta
        tenant = self.obtener_tenant()

        from .estado_comercial import estados_comerciales  # noqa: PLC0415

        comercial = estados_comerciales(tenant, {f["id"]: f["estado"] for f in filas})
        for fila in filas:
            fila["comercial"] = comercial.get(fila["id"])

        from apps.business.aplicar import modulos_activos  # noqa: PLC0415

        if "plano-carga" not in modulos_activos(tenant):
            return respuesta

        from apps.logistica.lotes import estados_logisticos  # noqa: PLC0415 — módulo opcional

        mapa = estados_logisticos(tenant, [f["id"] for f in filas])
        for fila in filas:
            fila["logistica"] = mapa.get(fila["id"])
        return respuesta

    def create(self, request, *args, **kwargs):
        serializer = CrearPedidoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(serializer.to_representation(pedido), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        pedido = self.get_object()
        serializer = EditarPedidoSerializer(
            instance=pedido, data=request.data, context={"request": request}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(serializer.to_representation(pedido))

    # PUT delega en el mismo flujo de edición parcial
    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="entregar")
    def entregar(self, request):
        """Marca como ENTREGADO un lote de pedidos (mirror de entregar_pedidos_view)."""
        ids = request.data.get("ids", [])
        ids = [i for i in ids if str(i).isdigit()]
        if not ids:
            return Response(
                {"message": "No se seleccionaron pedidos"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pedidos_qs = Pedido.objects.filter(id__in=ids)
        cantidad = pedidos_qs.count()
        if cantidad == 0:
            return Response(
                {"message": "Ninguno de los pedidos existe"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        total = pedidos_qs.aggregate(total=Sum("total_pedido"))["total"] or 0

        # La entrega es lo que convierte lo apartado en una salida real: la
        # mercancía deja de estar reservada y sale del saldo. Va antes del
        # `update` masivo y dentro de la misma transacción para que el pedido no
        # pueda quedar marcado como entregado sin haber descontado.
        #
        # Se recorre uno a uno porque `queryset.update()` no dispara señales ni
        # sabe de líneas; `despachar_pedido` es idempotente, así que pulsar dos
        # veces el botón —cosa que pasa— no descuenta dos veces.
        from apps.mensajeria.disparadores import pedido_cambio_estado  # noqa: PLC0415

        with transaction.atomic():
            recien_entregados = []
            for pedido in pedidos_qs:
                despachar_pedido(pedido, usuario=request.user)
                if pedido.estado != "ENTREGADO":
                    recien_entregados.append(pedido)
            pedidos_qs.update(estado="ENTREGADO")
            # `update()` no dispara señales: el aviso de entrega por WhatsApp se
            # pide aquí, y sale al confirmarse la transacción. Solo a los que
            # no estaban ya entregados, para no repetirlo si se pulsa dos veces.
            for pedido in recien_entregados:
                pedido_cambio_estado(pedido, "ENTREGADO")
                registrar_evento(
                    pedido,
                    "ESTADO",
                    "Marcó el pedido como entregado",
                    usuario=request.user,
                    anterior=pedido.estado,
                    nuevo="ENTREGADO",
                )

        lote = LotePedidos.objects.create(
            tipo="ENTREGA",
            usuario=request.user,
            cantidad_pedidos=cantidad,
            total_lote=total,
        )
        lote.pedidos.set(pedidos_qs)

        return Response({"success": True, "actualizados": cantidad, "lote_id": lote.id})

    @action(detail=False, methods=["post"], url_path="eliminar")
    def eliminar(self, request):
        """
        Borra de una vez los pedidos seleccionados en el panel.

        Se recorre uno a uno y no con `queryset.delete()` por dos razones: el
        queryset de la vista lleva `annotate()` y Django no borra sobre uno
        anotado, y cada borrado tiene que disparar su `post_delete`, que es la
        señal que devuelve al catálogo lo que el pedido tenía apartado.

        Todo en una transacción: si uno no se puede borrar no se borra ninguno,
        así que el panel nunca informa de una cantidad que no ocurrió. El
        queryset es el de la vista, ya acotado al negocio de la petición: una
        lista de ids ajenos no borra nada de otro tenant.
        """
        ids = [i for i in request.data.get("ids", []) if str(i).isdigit()]
        if not ids:
            return Response(
                {"message": "No se seleccionaron pedidos"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pedidos = list(self.get_queryset().filter(id__in=ids))
        if not pedidos:
            return Response(
                {"message": "Ninguno de los pedidos existe"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            with transaction.atomic():
                for pedido in pedidos:
                    pedido.delete()
        except ProtectedError:
            return Response(
                {
                    "message": (
                        "Alguno de los pedidos tiene documentos asociados y no se puede "
                        "eliminar. No se borró ninguno."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"success": True, "eliminados": len(pedidos)})

    @action(detail=False, methods=["post"], url_path="registrar")
    def registrar(self, request):
        """
        Apunta un pedido que llegó por teléfono, WhatsApp o mostrador.

        No es `create`: ese es el de la tienda, es público y aplica las reglas
        del comprador (que el negocio acepte pedidos online, cédula, acuerdo de
        precios). Aquí hay alguien del negocio identificado y con permiso, y lo
        que se apunta es lo que el cliente dictó.
        """
        serializer = RegistrarPedidoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(serializer.to_representation(pedido), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="historial")
    def historial(self, request, pk=None):
        """Historial de ediciones (cantidad/precio/nombre) de las líneas del pedido."""
        pedido = self.get_object()
        historial = (
            HistorialDetallePedido.objects.filter(detalle__pedido=pedido)
            .select_related("usuario", "detalle__presentacion__producto")
            .order_by("-fecha")
        )
        return Response(HistorialDetallePedidoSerializer(historial, many=True).data)

    @action(detail=True, methods=["get"], url_path="linea-de-tiempo")
    def linea_de_tiempo(self, request, pk=None):
        """
        Todo lo que le pasó al pedido —recibido, productos, entrega, estado,
        facturas— del más reciente al más antiguo. Ver `auditoria.py`.

        Sustituye a `historial/`, que se queda solo con las ediciones de línea
        registradas antes de que existiera `EventoPedido`.
        """
        pedido = self.get_object()
        return Response(linea_de_tiempo(pedido))


class ProductoPendienteViewSet(ExigeNegocioMixin, viewsets.ViewSet):
    """
    Productos personalizados (`DetallePedido.es_catalogo=False`) escritos por
    clientes en el storefront, a la espera de que el admin los revise:

    * `aprobar`  — se crea un producto nuevo en el catálogo y la línea del
      pedido queda enlazada a la presentación que pidió el cliente.
    * `vincular` — el producto YA existía (el cliente lo escribió a mano): la
      línea se enlaza a esa presentación y el catálogo no se duplica.
    * `rechazar` — queda tal cual en el pedido/factura, sin tocar el catálogo.

    Cada decisión deja un evento en la línea de tiempo del pedido, y la fila se
    bloquea al decidir: dos clics seguidos no crean dos productos.
    """

    permission_classes = [EsStaff]

    def get_permissions(self):
        if self.action == "list":
            return [requiere_permiso("orders.view_pedido")()]
        return super().get_permissions()

    def get_queryset(self):
        return (
            # Solo lo que sugirió un CLIENTE: un producto personalizado que el
            # negocio agrega a un pedido es una venta puntual, no una propuesta
            # para el catálogo.
            DetallePedido.objects.filter(
                es_catalogo=False, estado_revision="PENDIENTE", origen="CLIENTE"
            )
            .select_related("unidad_personalizada", "categoria_manual", "pedido__cliente")
            .order_by("-fecha_modificacion")
        )

    def _pendiente_bloqueado(self, pk):
        """La línea pendiente, con su fila bloqueada hasta el final de la transacción."""
        return get_object_or_404(self.get_queryset().select_for_update(of=("self",)), pk=pk)

    def list(self, request):
        serializer = ProductoPendienteSerializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @staticmethod
    def _enlazar(detalle, presentacion, *, conservar_precio, usuario):
        """
        Convierte la línea personalizada en una línea de catálogo.

        Por defecto toma el precio del catálogo (lo de siempre). Con
        `conservar_precio` se respeta el que ya tenía la línea: el negocio pudo
        haberlo pactado con el cliente antes de revisar el producto.
        """
        precio_antes = detalle.precio_unitario
        nombre_antes = detalle.nombre_personalizado
        detalle.presentacion = presentacion
        if not conservar_precio:
            detalle.precio_unitario = presentacion.precio_unitario
        detalle.nombre_personalizado = None
        detalle.unidad_personalizada = None
        detalle.categoria_manual = None
        detalle.es_catalogo = True
        detalle.nombre_congelado = detalle.descripcion_actual()
        detalle.save()  # full_clean() + recálculo de subtotal, ya en el modelo
        detalle.pedido.actualizar_total()
        # Ahora es una línea de catálogo: si el producto lleva existencias, se
        # aparta. Sin stock, la decisión entera se deshace (400).
        reservar_o_400(detalle.pedido, usuario=usuario)
        return nombre_antes, precio_antes

    @action(
        detail=True,
        methods=["post"],
        url_path="aprobar",
        permission_classes=[requiere_permiso("catalog.add_producto")],
    )
    @transaction.atomic
    def aprobar(self, request, pk=None):
        detalle = self._pendiente_bloqueado(pk)
        serializer = ProductoWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        producto = serializer.save()

        # La línea del pedido que originó este producto pendiente sigue "manual"
        # (presentacion=None) aunque ya exista en el catálogo, a menos que la
        # enlacemos aquí: si el admin creó una sola presentación, no hay
        # ambigüedad posible y se enlaza sola; si creó varias, se enlaza la que
        # el frontend indique como "la que pidió este cliente" (por posición,
        # ya que las presentaciones nuevas no tienen id hasta guardarse).
        presentaciones_creadas = list(
            producto.presentaciones.filter(estado_presentacion=True).order_by("id")
        )
        presentacion_elegida = None
        indice = request.data.get("presentacion_index")
        if indice is not None and str(indice).isdigit() and int(indice) < len(presentaciones_creadas):
            presentacion_elegida = presentaciones_creadas[int(indice)]
        elif len(presentaciones_creadas) == 1:
            presentacion_elegida = presentaciones_creadas[0]

        detalle.producto_generado = producto
        detalle.estado_revision = "ACEPTADO"
        nombre = detalle.nombre_personalizado

        if presentacion_elegida:
            _, precio_antes = self._enlazar(
                detalle,
                presentacion_elegida,
                conservar_precio=_verdadero(request.data.get("conservar_precio")),
                usuario=request.user,
            )
            registrar_evento(
                detalle.pedido,
                "CATALOGO",
                f"Aceptó «{nombre}» y lo creó en el catálogo",
                usuario=request.user,
                producto=producto.nombre_producto,
                presentacion=presentacion_elegida.nombre_presentacion,
                campo="precio_unitario",
                anterior=str(precio_antes),
                nuevo=str(detalle.precio_unitario),
            )
        else:
            detalle.save(update_fields=["producto_generado", "estado_revision"])
            registrar_evento(
                detalle.pedido,
                "CATALOGO",
                f"Aceptó «{nombre}» y lo creó en el catálogo (la línea sigue como personalizada)",
                usuario=request.user,
                producto=producto.nombre_producto,
            )

        return Response(serializer.to_representation(producto), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="vincular")
    @transaction.atomic
    def vincular(self, request, pk=None):
        """
        El cliente escribió a mano algo que el catálogo ya tiene: se enlaza la
        línea a esa presentación en vez de crear un producto repetido.
        """
        from apps.catalog.models import PresentacionProducto  # noqa: PLC0415

        detalle = self._pendiente_bloqueado(pk)
        presentacion_id = request.data.get("presentacion_id")
        if not str(presentacion_id or "").isdigit():
            return Response(
                {"presentacion_id": ["Elige la presentación del catálogo."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        presentacion = (
            PresentacionProducto.objects.select_related("producto", "unidad_venta")
            .filter(pk=presentacion_id)
            .first()
        )
        if presentacion is None:
            return Response(
                {"presentacion_id": ["Esa presentación no existe en este catálogo."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (presentacion.estado_presentacion and presentacion.producto.estado_producto):
            return Response(
                {"presentacion_id": ["Esa presentación está desactivada."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        detalle.estado_revision = "ACEPTADO"
        nombre, precio_antes = self._enlazar(
            detalle,
            presentacion,
            conservar_precio=_verdadero(request.data.get("conservar_precio")),
            usuario=request.user,
        )
        registrar_evento(
            detalle.pedido,
            "CATALOGO",
            f"Vinculó «{nombre}» a {presentacion.producto.nombre_producto} · {presentacion.nombre_presentacion}",
            usuario=request.user,
            producto=presentacion.producto.nombre_producto,
            presentacion=presentacion.nombre_presentacion,
            campo="precio_unitario",
            anterior=str(precio_antes),
            nuevo=str(detalle.precio_unitario),
        )
        return Response(
            {"success": True, "producto_id": presentacion.producto_id, "presentacion_id": presentacion.id}
        )

    @action(detail=True, methods=["post"], url_path="rechazar")
    @transaction.atomic
    def rechazar(self, request, pk=None):
        detalle = self._pendiente_bloqueado(pk)
        detalle.estado_revision = "RECHAZADO"
        detalle.save(update_fields=["estado_revision"])
        registrar_evento(
            detalle.pedido,
            "CATALOGO",
            f"Rechazó «{detalle.nombre_personalizado}» para el catálogo (queda solo en el pedido)",
            usuario=request.user,
        )
        return Response({"success": True})


def _verdadero(valor) -> bool:
    return valor is True or str(valor).lower() in ("1", "true", "si", "sí")


class LoteViewSet(TenantScopedMixin, mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    Lotes de pedidos generados al imprimir o entregar en masa.

    Se leen y se borran, nada más: un lote no se crea ni se edita a mano, lo
    escribe el servidor cuando alguien imprime o entrega en bloque. De ahí el
    `DestroyModelMixin` suelto en vez de un `ModelViewSet`, que abriría un POST
    y un PATCH que nadie debería usar.

    Borrar un lote borra el REGISTRO de que esos pedidos se procesaron juntos,
    no los pedidos: `pedidos` es una M2M, así que solo cae la agrupación. Sirve
    para limpiar la lista de pruebas y duplicados; el precio es que se pierde
    esa pista de trazabilidad —quién imprimió qué y cuándo—, y por eso exige el
    mismo permiso que borrar pedidos.
    """

    modelo = LotePedidos

    def get_permissions(self):
        if self.action in ("destroy", "eliminar"):
            return [requiere_permiso("orders.delete_pedido")()]
        return [EsStaff()]

    def get_queryset(self):
        return super().get_queryset().select_related("usuario").prefetch_related("pedidos")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return LoteDetailSerializer
        return LoteSerializer

    @action(detail=False, methods=["post"], url_path="eliminar")
    def eliminar(self, request):
        """
        Borra de una vez los lotes seleccionados en el panel.

        Mismo trato que el borrado masivo de pedidos: una transacción, el
        queryset ya acotado al negocio de la petición, y la cuenta que se
        devuelve es la que de verdad se borró.
        """
        ids = [i for i in request.data.get("ids", []) if str(i).isdigit()]
        if not ids:
            return Response(
                {"message": "No se seleccionaron lotes"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lotes = list(self.get_queryset().filter(id__in=ids))
        if not lotes:
            return Response(
                {"message": "Ninguno de los lotes existe"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for lote in lotes:
                lote.delete()
        return Response({"success": True, "eliminados": len(lotes)})


class ClienteViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Clientes (solo staff)."""

    serializer_class = ClienteSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [requiere_permiso("orders.change_cliente")()]
        if self.action == "destroy":
            return [requiere_permiso("orders.delete_cliente")()]
        return [requiere_permiso("orders.view_cliente")()]

    @action(detail=True, methods=["get"], url_path="hoja-de-vida")
    def hoja_de_vida(self, request, pk=None):
        """Lo que ha sido este cliente para el negocio, para la ficha del panel."""
        from .hoja_de_vida import calcular  # noqa: PLC0415

        return Response(calcular(self.get_object()))

    @action(detail=False, methods=["get"], url_path="alertas")
    def catalogo_alertas(self, request):
        """Las alertas que se le pueden activar a un cliente, para el panel."""
        from .alertas_cliente import ALERTAS  # noqa: PLC0415

        return Response(ALERTAS)

    def get_queryset(self):
        qs = Cliente.objects.all()
        query = self.request.query_params.get("q")
        if query:
            qs = qs.filter(
                Q(nombre_cliente__icontains=query)
                | Q(telefono_cliente__icontains=query)
                | Q(documento_cliente__icontains=query)
            )
        return qs
