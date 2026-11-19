from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from apps.tenancy.fields import ClaveDelNegocio

from apps.catalog.models import Categoria, PresentacionProducto, UnidadMedida

from .models import Cliente, DetallePedido, HistorialDetallePedido, LotePedidos, Pedido


def reservar_o_400(pedido, *, usuario=None):
    """
    Ajusta la reserva del pedido y traduce la falta de stock a un 400.

    Sin esta traducción, quedarse sin mercancía saldría como un 500: un fallo
    del servidor, cuando en realidad es una respuesta perfectamente normal a una
    petición que pide más de lo que hay. El mensaje de `StockInsuficiente` está
    escrito para que lo lea una persona, así que viaja tal cual.
    """
    from apps.inventory.operaciones import ErrorDeInventario  # noqa: PLC0415
    from .inventario import resincronizar_reserva  # noqa: PLC0415

    try:
        resincronizar_reserva(pedido, usuario=usuario)
    except ErrorDeInventario as error:
        raise serializers.ValidationError({"stock": str(error)}) from error


# ==========================================================================
# CLIENTE
# ==========================================================================
from . import alertas_cliente

class ClienteSerializer(serializers.ModelSerializer):
    total_pedidos = serializers.IntegerField(source="pedidos.count", read_only=True)
    # Se lee con todas las alertas ya resueltas (lo guardado o su valor por
    # defecto) y se escribe parcial: solo los códigos que cambian.
    alertas = serializers.JSONField(required=False)

    class Meta:
        model = Cliente
        fields = [
            "id",
            "nombre_cliente",
            "telefono_cliente",
            "direccion_cliente",
            "documento_cliente",
            "acepto_precios_en",
            "autorizo_datos_en",
            "acepta_whatsapp",
            "whatsapp_decidido_en",
            "fecha_registro_cliente",
            "total_pedidos",
            "alertas",
        ]
        # La autorización de datos solo la da el cliente (en la tienda). El
        # consentimiento de WhatsApp sí lo puede registrar el equipo: lo pidió
        # por teléfono o en el mostrador. Lo que nunca se edita es la fecha.
        read_only_fields = ["acepto_precios_en", "autorizo_datos_en", "whatsapp_decidido_en"]

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        datos["alertas"] = alertas_cliente.efectivas(instance.alertas)
        return datos

    def validate_alertas(self, valor):
        if not isinstance(valor, dict):
            raise serializers.ValidationError("Envía las alertas como {código: true/false}.")
        desconocidas = [c for c in valor if c not in alertas_cliente.POR_CODIGO]
        if desconocidas:
            raise serializers.ValidationError(f"Alertas desconocidas: {', '.join(desconocidas)}.")
        if not all(isinstance(v, bool) for v in valor.values()):
            raise serializers.ValidationError("Cada alerta se activa con true o se desactiva con false.")
        # Se mezcla con lo ya guardado: cambiar una no reinicia las demás.
        anteriores = dict(getattr(self.instance, "alertas", None) or {})
        return {**anteriores, **valor}

    def create(self, validated_data):
        if validated_data.get("acepta_whatsapp"):
            from django.utils import timezone  # noqa: PLC0415

            validated_data["whatsapp_decidido_en"] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "acepta_whatsapp" in validated_data and validated_data["acepta_whatsapp"] != instance.acepta_whatsapp:
            from django.utils import timezone  # noqa: PLC0415

            validated_data["whatsapp_decidido_en"] = timezone.now()
        return super().update(instance, validated_data)

    def validate_documento_cliente(self, valor):
        """
        Desde el panel se puede poner o corregir la cédula —por ejemplo, para
        que un cliente de antes la use en la tienda—, con las mismas reglas que
        en la tienda y sin repetir la de otro cliente.
        """
        if not (valor or "").strip():
            return ""
        from .clientes_tienda import normalizar_documento  # noqa: PLC0415

        documento = normalizar_documento(valor)
        otros = Cliente.objects.filter(documento_cliente=documento)
        if self.instance is not None:
            otros = otros.exclude(pk=self.instance.pk)
        if otros.exists():
            raise serializers.ValidationError("Ya hay otro cliente con esta cédula.")
        return documento


# ==========================================================================
# LECTURA DE PEDIDOS
# ==========================================================================
class PedidoListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    num_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Pedido
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "estado",
            "total_pedido",
            "fecha_pedido",
            "num_items",
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre_cliente if obj.cliente else ""


class DetallePedidoSerializer(serializers.Serializer):
    """Representa una línea de pedido tal como la esperaba `detalle_pedido_api`."""

    id = serializers.IntegerField()
    detalle_id = serializers.IntegerField(source="id")
    presentacion_id = serializers.SerializerMethodField()
    producto_id = serializers.SerializerMethodField()
    presentacion_nombre = serializers.SerializerMethodField()
    nombre_producto = serializers.SerializerMethodField()
    categoria = serializers.SerializerMethodField()
    unidad_id = serializers.SerializerMethodField()
    unidad_nombre = serializers.SerializerMethodField()
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    personalizado = serializers.SerializerMethodField()
    estado_revision = serializers.SerializerMethodField()
    #: CLIENTE (lo pidió en la tienda) o ADMIN (lo agregó el negocio).
    origen = serializers.CharField()
    agregado_por_nombre = serializers.SerializerMethodField()
    #: Lo que pidió el cliente; nulo en las líneas que agregó el negocio.
    cantidad_original = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    precio_original = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    fue_modificado = serializers.BooleanField()
    nota = serializers.CharField()
    categoria_id = serializers.SerializerMethodField()

    def get_agregado_por_nombre(self, obj):
        usuario = obj.agregado_por
        return (getattr(usuario, "nombre_usuario", "") or "") if usuario else ""

    def get_categoria_id(self, obj):
        if obj.presentacion:
            return obj.presentacion.producto.categoria_id
        return obj.categoria_manual_id

    def get_presentacion_id(self, obj):
        return obj.presentacion_id

    def get_producto_id(self, obj):
        return obj.presentacion.producto_id if obj.presentacion else None

    def get_presentacion_nombre(self, obj):
        return obj.presentacion.nombre_presentacion if obj.presentacion else None

    def get_nombre_producto(self, obj):
        if obj.presentacion:
            return obj.presentacion.producto.nombre_producto
        return obj.nombre_personalizado

    def get_categoria(self, obj):
        if obj.presentacion:
            cat = obj.presentacion.producto.categoria
            return cat.nombre_categoria if cat else ""
        return obj.categoria_manual.nombre_categoria if obj.categoria_manual else ""

    def get_unidad_id(self, obj):
        if obj.presentacion:
            return obj.presentacion.unidad_venta_id
        return obj.unidad_personalizada_id

    def get_unidad_nombre(self, obj):
        if obj.presentacion:
            return obj.presentacion.unidad_venta.nombre_unidad
        return obj.unidad_personalizada.nombre_unidad if obj.unidad_personalizada else ""

    def get_personalizado(self, obj):
        return obj.presentacion is None

    def get_estado_revision(self, obj):
        # Lo que agrega el negocio no es una sugerencia del cliente: no pasa
        # por la revisión de productos nuevos.
        if obj.presentacion or obj.origen == "ADMIN":
            return None
        return obj.estado_revision


class PedidoDetailSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    cliente_telefono = serializers.SerializerMethodField()
    cliente_direccion = serializers.SerializerMethodField()
    cliente_documento = serializers.SerializerMethodField()
    editado_por_nombre = serializers.SerializerMethodField()
    detalles = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "cliente_telefono",
            "cliente_direccion",
            "cliente_documento",
            "estado",
            "total_pedido",
            "observaciones",
            "fecha_pedido",
            "fecha_modificacion",
            "editado_por_nombre",
            "detalles",
            "direccion_entrega",
            "direccion_de_entrega",
            "telefono_entrega",
            "telefono_de_contacto",
            "recibe_nombre",
            "fecha_programada",
            "indicaciones_entrega",
            "notas_internas",
        ]

    #: A dónde se lleva de verdad: la de este pedido si el cliente pidió otra,
    #: si no la suya. `direccion_entrega` sola dice si es una dirección puntual.
    direccion_de_entrega = serializers.CharField(read_only=True)
    telefono_de_contacto = serializers.CharField(read_only=True)

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre_cliente if obj.cliente else ""

    def get_cliente_telefono(self, obj):
        return obj.cliente.telefono_cliente if obj.cliente else ""

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion_cliente if obj.cliente else ""

    def get_cliente_documento(self, obj):
        return obj.cliente.documento_cliente if obj.cliente else ""

    def get_editado_por_nombre(self, obj):
        return (getattr(obj.editado_por, "nombre_usuario", "") or "") if obj.editado_por_id else ""

    def get_detalles(self, obj):
        detalles = obj.detalles.select_related(
            "presentacion__producto__categoria",
            "presentacion__unidad_venta",
            "categoria_manual",
            "unidad_personalizada",
            "agregado_por",
        ).order_by("id")
        return DetallePedidoSerializer(detalles, many=True).data


# ==========================================================================
# CREACIÓN PÚBLICA DE PEDIDO (storefront)
# ==========================================================================
AVISO_AUTORIZACION = (
    "Para enviar el pedido necesitamos tu autorización para tratar tus datos "
    "personales según nuestra política."
)


class ClienteInputSerializer(serializers.Serializer):
    # Opcional porque un cliente con cédula y datos guardados no vuelve a
    # escribir su nombre; `CrearPedidoSerializer.validate` decide cuándo falta.
    nombre = serializers.CharField(max_length=200, required=False, allow_blank=True)
    telefono = serializers.CharField(max_length=25, required=False, allow_blank=True)
    direccion = serializers.CharField(required=False, allow_blank=True)
    cedula = serializers.CharField(max_length=30, required=False, allow_blank=True)
    #: El acuerdo "el precio final se ajusta al mercado del día". En modo
    #: cédula se exige en el primer pedido y se guarda en el cliente.
    acepta_precios = serializers.BooleanField(required=False, default=False)
    #: La autorización de tratamiento de datos (Ley 1581). Se exige mientras
    #: el cliente no la haya dado antes, y se guarda con su fecha.
    autoriza_datos = serializers.BooleanField(required=False, default=False)
    #: Si acepta los avisos del pedido por WhatsApp. `None` = no se le
    #: preguntó en este pedido (ya lo había decidido): no cambia nada.
    acepta_whatsapp = serializers.BooleanField(required=False, allow_null=True, default=None)
    #: Solo para este pedido: la dirección guardada del cliente no cambia.
    direccion_entrega = serializers.CharField(required=False, allow_blank=True)


class ItemCatalogoSerializer(serializers.Serializer):
    presentacion_id = ClaveDelNegocio(PresentacionProducto, source="presentacion")
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))

    def validate(self, attrs):
        """
        Lo que la tienda ya impide, comprobado otra vez aquí: el carrito vive
        en el navegador y puede traer una presentación que se desactivó ayer,
        o una cantidad que la regla de hoy ya no admite.
        """
        from apps.catalog import cantidades  # noqa: PLC0415

        presentacion = attrs["presentacion"]
        nombre = f"{presentacion.producto.nombre_producto} ({presentacion.nombre_presentacion})"
        if not (presentacion.estado_presentacion and presentacion.producto.estado_producto):
            raise serializers.ValidationError(
                {"presentacion_id": f"{nombre} ya no está disponible. Quítalo del pedido."}
            )
        if not cantidades.cantidad_valida(
            attrs["cantidad"],
            presentacion.cantidad_minima,
            presentacion.incremento_cantidad,
            presentacion.decimales_cantidad,
        ):
            raise serializers.ValidationError(
                {
                    "cantidad": f"{nombre} se pide {cantidades.describir(presentacion)}. "
                    "Ajusta la cantidad."
                }
            )
        return attrs


class ItemPersonalizadoSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=255)
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    precio_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )
    unidad_id = ClaveDelNegocio(
        UnidadMedida, source="unidad", required=False, allow_null=True
    )
    categoria_id = ClaveDelNegocio(
        Categoria, source="categoria", required=False, allow_null=True
    )


class CrearPedidoSerializer(serializers.Serializer):
    """
    Reescribe `generar_pedido` como API JSON, conservando la lógica de negocio:
    get_or_create del Cliente, creación de DetallePedido (catálogo y personalizados)
    y recálculo del total.
    """

    cliente = ClienteInputSerializer()
    items = ItemCatalogoSerializer(many=True, required=False, default=list)
    personalizados = ItemPersonalizadoSerializer(many=True, required=False, default=list)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("items") and not attrs.get("personalizados"):
            raise serializers.ValidationError(
                "El pedido debe incluir al menos un producto."
            )

        # Hay negocios cuyo canal es el mostrador y no internet —una ferreteria,
        # un restaurante sin domicilios—. Su tienda sigue siendo un catalogo
        # que se puede ver; lo que no se puede es pedir desde ella.
        #
        # Se comprueba en el servidor y no solo ocultando el boton: quien tenga
        # la URL del endpoint puede llamarlo igual.
        from apps.business.consulta import puede  # noqa: PLC0415

        peticion = self.context.get("request")
        tenant = getattr(peticion, "tenant", None)
        if not puede(tenant, "acepta_pedidos_online"):
            raise serializers.ValidationError(
                "Este negocio no recibe pedidos por internet. Escribenos o "
                "acercate al punto de venta."
            )

        from .clientes_tienda import buscar_por_documento, normalizar_documento, usa_cedula  # noqa: PLC0415

        datos = attrs["cliente"]
        if usa_cedula(tenant):
            try:
                datos["cedula"] = normalizar_documento(datos.get("cedula"))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"cliente": {"cedula": exc.detail}})
            existente = buscar_por_documento(datos["cedula"])
            # Primer pedido (o uno anterior que quedó a medias): se piden los
            # datos y el acuerdo de precios UNA vez. Después, ya no.
            if existente is None or not existente.datos_completos:
                faltan = {
                    campo: mensaje
                    for campo, mensaje in (
                        ("nombre", "Escribe tu nombre o el de tu negocio."),
                        ("telefono", "Escribe un teléfono de contacto."),
                        ("direccion", "Escribe la dirección de entrega."),
                    )
                    if not (datos.get(campo) or "").strip()
                }
                if not datos.get("acepta_precios"):
                    faltan["acepta_precios"] = (
                        "Confirma que aceptas que el precio final se ajuste al mercado del día."
                    )
                if faltan:
                    raise serializers.ValidationError({"cliente": faltan})
            attrs["_por_cedula"] = True
            attrs["_cliente_existente"] = existente
            ya_autorizo = existente is not None and existente.autorizo_datos_en is not None
        elif not (datos.get("nombre") or "").strip():
            raise serializers.ValidationError({"cliente": {"nombre": "Escribe tu nombre."}})
        else:
            # Por nombre no hay forma segura de saber si ESTA persona ya
            # autorizó: el nombre no la identifica. Se pide en cada pedido.
            ya_autorizo = False

        if not ya_autorizo and not datos.get("autoriza_datos"):
            raise serializers.ValidationError(
                {"cliente": {"autoriza_datos": AVISO_AUTORIZACION}}
            )
        return attrs

    def _cliente_por_nombre(self, datos):
        """El comportamiento de siempre: el nombre es la llave."""
        nombre = datos["nombre"].strip()
        cliente = Cliente.objects.filter(nombre_cliente=nombre).order_by("id").first()
        if cliente is None:
            cliente = Cliente.objects.create(nombre_cliente=nombre)
        # Actualiza contacto si viene y el cliente aún no lo tenía.
        actualizar = []
        if datos.get("telefono") and not cliente.telefono_cliente:
            cliente.telefono_cliente = datos["telefono"]
            actualizar.append("telefono_cliente")
        if datos.get("direccion") and not cliente.direccion_cliente:
            cliente.direccion_cliente = datos["direccion"]
            actualizar.append("direccion_cliente")
        if actualizar:
            cliente.save(update_fields=actualizar)
        return cliente

    def _cliente_por_cedula(self, datos, existente):
        """
        Con los datos completos, el cliente es quien es: lo que venga en el
        formulario no pisa lo guardado (quien sepa una cédula ajena no puede
        cambiarle el teléfono ni la dirección a esa persona).
        """
        if existente is not None and existente.datos_completos:
            return existente
        from django.utils import timezone  # noqa: PLC0415

        from django.db import IntegrityError  # noqa: PLC0415

        cliente = existente or Cliente(documento_cliente=datos["cedula"])
        cliente.nombre_cliente = datos["nombre"].strip()
        cliente.telefono_cliente = datos["telefono"].strip()
        cliente.direccion_cliente = datos["direccion"].strip()
        cliente.acepto_precios_en = timezone.now()
        try:
            # Punto de guardado propio: si dos primeros pedidos con la misma
            # cédula llegan a la vez, el segundo choca con la unicidad y se
            # queda con el cliente que acaba de crear el primero.
            with transaction.atomic():
                cliente.save()
        except IntegrityError:
            cliente = Cliente.objects.get(documento_cliente=datos["cedula"])
        return cliente

    def _registrar_consentimientos(self, cliente, datos, *, conocido: bool):
        """
        Guarda la autorización de datos y la decisión sobre WhatsApp, con su
        fecha: es la prueba que piden la Ley 1581 y Meta.

        A un cliente con cédula y datos completos, lo que llegue del
        formulario solo puede COMPLETAR lo que nunca decidió, no cambiarlo:
        quien conozca una cédula ajena no debe poder suscribir ni dar de baja
        a esa persona. Retirar el consentimiento se hace respondiendo «BAJA»
        o pidiéndoselo al negocio.
        """
        from django.utils import timezone  # noqa: PLC0415

        ahora = timezone.now()
        campos = []
        if datos.get("autoriza_datos") and cliente.autorizo_datos_en is None:
            cliente.autorizo_datos_en = ahora
            campos.append("autorizo_datos_en")
        whatsapp = datos.get("acepta_whatsapp")
        if whatsapp is not None and (not conocido or cliente.whatsapp_decidido_en is None):
            cliente.acepta_whatsapp = whatsapp
            cliente.whatsapp_decidido_en = ahora
            campos += ["acepta_whatsapp", "whatsapp_decidido_en"]
        if campos:
            cliente.save(update_fields=campos)

    @transaction.atomic
    def create(self, validated_data):
        datos_cliente = validated_data["cliente"]
        request = self.context.get("request")

        existente = validated_data.get("_cliente_existente")
        if validated_data.get("_por_cedula"):
            cliente = self._cliente_por_cedula(datos_cliente, existente)
            conocido = existente is not None and existente.datos_completos
        else:
            cliente = self._cliente_por_nombre(datos_cliente)
            conocido = False
        self._registrar_consentimientos(cliente, datos_cliente, conocido=conocido)

        usuario = None
        if request and request.user and request.user.is_authenticated:
            usuario = request.user

        # La dirección de un pedido puntual solo se guarda si es otra: igual a
        # la del cliente, sería un duplicado que después no se sabe cuál manda.
        direccion_entrega = (datos_cliente.get("direccion_entrega") or "").strip()
        if direccion_entrega == cliente.direccion_cliente.strip():
            direccion_entrega = ""

        pedido = Pedido.objects.create(
            cliente=cliente, usuario=usuario, estado="PENDIENTE",
            observaciones=validated_data.get("observaciones", ""),
            direccion_entrega=direccion_entrega,
        )

        for item in validated_data.get("items", []):
            presentacion = item["presentacion"]
            DetallePedido.objects.create(
                pedido=pedido,
                presentacion=presentacion,
                cantidad=item["cantidad"],
                precio_unitario=presentacion.precio_unitario,
                es_catalogo=True,
            )

        for item in validated_data.get("personalizados", []):
            DetallePedido.objects.create(
                pedido=pedido,
                nombre_personalizado=item["nombre"].strip(),
                cantidad=item["cantidad"],
                precio_unitario=item.get("precio_unitario") or Decimal("0"),
                unidad_personalizada=item.get("unidad"),
                categoria_manual=item.get("categoria"),
                es_catalogo=False,
            )

        pedido.actualizar_total()
        # La foto de lo que pidió el cliente, antes de que nadie lo toque.
        from .auditoria import registrar_recibido  # noqa: PLC0415

        registrar_recibido(pedido)
        # Aparta la mercancía de las líneas de catálogo. Va DENTRO del `atomic`
        # de este método a propósito: si no hay stock, el pedido entero no se
        # guarda. Un pedido confirmado que no se puede entregar es peor que un
        # pedido rechazado, porque el cliente ya se fue creyendo que llegaría.
        reservar_o_400(pedido, usuario=usuario)
        return pedido

    def to_representation(self, instance):
        from .clientes_tienda import enmascarar_nombre  # noqa: PLC0415

        return {
            "success": True,
            "pedido_id": instance.id,
            "total": instance.total_pedido,
            "estado": instance.estado,
            # Quien pidió con su cédula no escribió su nombre: la tienda lo
            # necesita para el saludo y el mensaje de WhatsApp.
            "cliente_nombre": enmascarar_nombre(instance.cliente.nombre_cliente) if instance.cliente else "",
        }


# ==========================================================================
# PRODUCTOS PERSONALIZADOS PENDIENTES DE REVISIÓN
# ==========================================================================
class ProductoPendienteSerializer(serializers.Serializer):
    """Línea personalizada (`es_catalogo=False`) a la espera de que el admin
    la acepte (convertida en producto de catálogo) o la rechace."""

    id = serializers.IntegerField()
    nombre_personalizado = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    unidad_id = serializers.IntegerField(source="unidad_personalizada_id")
    unidad_nombre = serializers.SerializerMethodField()
    categoria_id = serializers.IntegerField(source="categoria_manual_id")
    categoria_nombre = serializers.SerializerMethodField()
    pedido = serializers.IntegerField(source="pedido_id")
    cliente_nombre = serializers.SerializerMethodField()
    fecha_modificacion = serializers.DateTimeField()
    #: Contexto para revisar: cuándo pidió, en qué estado está el pedido y
    #: qué añadió el cliente sobre el producto.
    pedido_fecha = serializers.DateTimeField(source="pedido.fecha_pedido")
    pedido_estado = serializers.CharField(source="pedido.estado")
    nota = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)

    def get_unidad_nombre(self, obj):
        return obj.unidad_personalizada.nombre_unidad if obj.unidad_personalizada else ""

    def get_categoria_nombre(self, obj):
        return obj.categoria_manual.nombre_categoria if obj.categoria_manual else ""

    def get_cliente_nombre(self, obj):
        cliente = obj.pedido.cliente
        return cliente.nombre_cliente if cliente else ""


# ==========================================================================
# EDICIÓN ADMINISTRATIVA DE PEDIDO
# ==========================================================================
class PedidoDesactualizado(APIException):
    """
    El pedido cambió desde que el panel lo abrió.

    Es lo que impide dos cosas a la vez: que un doble clic en «Guardar» cree
    dos veces las líneas nuevas (la segunda petición llega con una versión que
    ya no es la vigente) y que dos personas editando el mismo pedido se pisen
    sin enterarse.
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "Este pedido se modificó mientras lo tenías abierto. Vuelve a abrirlo "
        "para ver la versión actual antes de guardar."
    )
    default_code = "pedido_desactualizado"


class EditarDetalleSerializer(serializers.Serializer):
    detalle_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    presentacion_id = ClaveDelNegocio(
        PresentacionProducto, source="presentacion", required=False, allow_null=True
    )
    cantidad = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01"),
        error_messages={"min_value": "La cantidad debe ser mayor a 0."},
    )
    precio_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"),
        error_messages={"min_value": "El precio no puede ser negativo."},
    )
    nombre_producto = serializers.CharField(required=False, allow_blank=True, max_length=255)
    unidad_id = ClaveDelNegocio(
        UnidadMedida, source="unidad_personalizada", required=False, allow_null=True
    )
    categoria_id = ClaveDelNegocio(
        Categoria, source="categoria_manual", required=False, allow_null=True
    )
    #: Observación de la línea. Ausente = no se toca.
    nota = serializers.CharField(required=False, allow_blank=True, max_length=500)


#: Los datos de entrega que el panel puede cambiar, con su nombre legible.
CAMPOS_ENTREGA = {
    "direccion_entrega": "Dirección de entrega",
    "telefono_entrega": "Teléfono de contacto",
    "recibe_nombre": "Persona que recibe",
    "fecha_programada": "Fecha programada",
    "indicaciones_entrega": "Indicaciones de entrega",
}


class EditarPedidoSerializer(serializers.Serializer):
    """
    La edición del pedido desde el panel: líneas, entrega y notas internas.

    Todo es opcional —lo que no viene no se toca— salvo que, si vienen las
    líneas, vienen TODAS: las que falten se quitan del pedido.

    Cada cambio deja un `EventoPedido` con la foto de lo que había, y lo que
    pidió el cliente (`cantidad_original`, `precio_original` y el evento
    «recibido») no se reescribe nunca.
    """

    detalles = EditarDetalleSerializer(many=True, required=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    #: `fecha_modificacion` del pedido tal como lo leyó el panel.
    version = serializers.DateTimeField(required=False, allow_null=True)

    direccion_entrega = serializers.CharField(required=False, allow_blank=True)
    telefono_entrega = serializers.CharField(required=False, allow_blank=True, max_length=25)
    recibe_nombre = serializers.CharField(required=False, allow_blank=True, max_length=150)
    fecha_programada = serializers.DateTimeField(required=False, allow_null=True)
    indicaciones_entrega = serializers.CharField(required=False, allow_blank=True)
    notas_internas = serializers.CharField(required=False, allow_blank=True)

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError(
                "El pedido debe tener al menos un producto."
            )
        ids = [item["detalle_id"] for item in value if item.get("detalle_id")]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Un mismo producto del pedido llegó dos veces.")
        return value

    def validate_telefono_entrega(self, value):
        value = value.strip()
        if value and sum(c.isdigit() for c in value) < 7:
            raise serializers.ValidationError("Escribe un teléfono válido (al menos 7 dígitos).")
        return value

    # ------------------------------------------------------------------
    @transaction.atomic
    def update(self, pedido, validated_data):
        from . import auditoria  # noqa: PLC0415

        usuario = self.context["request"].user
        # Bloquea la fila: dos guardados del mismo pedido se ponen en fila y el
        # segundo ve la versión que dejó el primero.
        pedido = Pedido.objects.select_for_update().get(pk=pedido.pk)

        version = validated_data.get("version")
        if version is not None and pedido.fecha_modificacion is not None:
            if abs((pedido.fecha_modificacion - version).total_seconds()) > 0.001:
                raise PedidoDesactualizado()

        hubo_cambios = False
        if "detalles" in validated_data:
            hubo_cambios |= self._aplicar_lineas(pedido, validated_data["detalles"], usuario, auditoria)
        hubo_cambios |= self._aplicar_entrega(pedido, validated_data, usuario, auditoria)

        if hubo_cambios:
            pedido.editado_por = usuario
        # Guardar siempre: `fecha_modificacion` es la versión, y avanzarla es
        # lo que hace que un reenvío de esta misma petición se rechace.
        pedido.save()
        # La edición pudo subir cantidades, bajarlas, añadir líneas o quitarlas.
        # `resincronizar_reserva` trabaja por diferencia contra lo ya apartado,
        # así que una sola llamada al final cubre los cuatro casos — y no hace
        # nada si al final el pedido pide lo mismo que antes.
        reservar_o_400(pedido, usuario=usuario)
        return pedido

    # ------------------------------------------------------------------
    def _aplicar_lineas(self, pedido, items, usuario, auditoria) -> bool:
        ids_recibidos = []
        hubo_cambios = False
        existentes = {
            d.id: d
            for d in pedido.detalles.select_related(
                "presentacion__producto", "presentacion__unidad_venta", "unidad_personalizada"
            )
        }

        for item in items:
            detalle_id = item.get("detalle_id")
            if detalle_id:
                detalle = existentes.get(detalle_id)
                if detalle is None:
                    raise serializers.ValidationError(
                        "Uno de los productos no pertenece a este pedido."
                    )
                hubo_cambios |= self._editar_linea(pedido, detalle, item, usuario, auditoria)
                ids_recibidos.append(detalle.id)
            else:
                detalle = self._crear_linea(pedido, item, usuario)
                foto = auditoria.foto_de_linea(detalle)
                auditoria.registrar(
                    pedido,
                    "PRODUCTO_AGREGADO",
                    f"Agregó {auditoria.etiqueta_de_linea(foto)}",
                    usuario=usuario,
                    linea=foto,
                )
                ids_recibidos.append(detalle.id)
                hubo_cambios = True

        for detalle in existentes.values():
            if detalle.id in ids_recibidos:
                continue
            foto = auditoria.foto_de_linea(detalle)
            foto["cantidad_original"] = auditoria._texto(detalle.cantidad_original)
            auditoria.registrar(
                pedido,
                "PRODUCTO_ELIMINADO",
                f"Quitó {auditoria.etiqueta_de_linea(foto)}",
                usuario=usuario,
                linea=foto,
            )
            detalle.delete()
            hubo_cambios = True

        pedido.total_pedido = sum(
            (d.subtotal for d in pedido.detalles.all()), Decimal("0")
        )
        return hubo_cambios

    def _editar_linea(self, pedido, detalle, item, usuario, auditoria) -> bool:
        cantidad = item["cantidad"]
        precio_unitario = item["precio_unitario"]
        nueva_presentacion = item.get("presentacion")
        foto_antes = auditoria.foto_de_linea(detalle)
        etiqueta = auditoria.etiqueta_de_linea(foto_antes)

        eventos = []  # (tipo, descripcion, datos)
        legado = []  # (campo, anterior, nuevo) para `fue_modificado`

        if detalle.presentacion_id is not None:
            # Línea de catálogo: solo puede pasar a otra presentación DEL MISMO
            # producto, nunca convertirse en personalizada ni en otro producto.
            if (item.get("nombre_producto") or "").strip() and nueva_presentacion is None:
                raise serializers.ValidationError(
                    "No se puede convertir un producto de catálogo en "
                    "personalizado; elimínalo y agrega uno nuevo."
                )
            if nueva_presentacion and nueva_presentacion.id != detalle.presentacion_id:
                if nueva_presentacion.producto_id != detalle.presentacion.producto_id:
                    raise serializers.ValidationError(
                        f"La presentación elegida no corresponde a {detalle.presentacion.producto.nombre_producto}."
                    )
                _exigir_presentacion_vendible(nueva_presentacion)
                anterior = _etiqueta_presentacion(detalle.presentacion)
                nueva = _etiqueta_presentacion(nueva_presentacion)
                eventos.append((
                    "PRESENTACION",
                    f"Cambió la presentación de {detalle.presentacion.producto.nombre_producto}",
                    {"campo": "presentacion", "anterior": anterior, "nuevo": nueva},
                ))
                legado.append("presentacion")
                detalle.presentacion = nueva_presentacion
                detalle.nombre_congelado = detalle.descripcion_actual()
        else:
            if nueva_presentacion:
                raise serializers.ValidationError(
                    "No se puede convertir un producto personalizado en "
                    "catálogo; elimínalo y agrega uno nuevo."
                )
            nuevo_nombre = (item.get("nombre_producto") or "").strip()
            if nuevo_nombre and nuevo_nombre != detalle.nombre_personalizado:
                eventos.append((
                    "PRODUCTO_EDITADO",
                    f"Renombró {detalle.nombre_personalizado}",
                    {"campo": "nombre", "anterior": detalle.nombre_personalizado, "nuevo": nuevo_nombre},
                ))
                legado.append("nombre_personalizado")
                detalle.nombre_personalizado = nuevo_nombre
                detalle.nombre_congelado = nuevo_nombre

            nueva_unidad = item.get("unidad_personalizada")
            if nueva_unidad and nueva_unidad.id != detalle.unidad_personalizada_id:
                eventos.append((
                    "PRODUCTO_EDITADO",
                    f"Cambió la unidad de {detalle.nombre_personalizado}",
                    {
                        "campo": "unidad",
                        "anterior": detalle.unidad_personalizada.nombre_unidad
                        if detalle.unidad_personalizada
                        else "—",
                        "nuevo": nueva_unidad.nombre_unidad,
                    },
                ))
                legado.append("unidad_personalizada")
                detalle.unidad_personalizada = nueva_unidad

        if detalle.cantidad != cantidad:
            eventos.append((
                "CANTIDAD",
                f"Cambió la cantidad de {etiqueta}",
                {"campo": "cantidad", "anterior": auditoria._texto(detalle.cantidad), "nuevo": auditoria._texto(cantidad)},
            ))
            legado.append("cantidad")
        if detalle.precio_unitario != precio_unitario:
            eventos.append((
                "PRECIO",
                f"Cambió el precio de {etiqueta}",
                {
                    "campo": "precio_unitario",
                    "anterior": auditoria._texto(detalle.precio_unitario),
                    "nuevo": auditoria._texto(precio_unitario),
                },
            ))
            legado.append("precio_unitario")

        nota = item.get("nota")
        if nota is not None and nota.strip() != detalle.nota:
            eventos.append((
                "PRODUCTO_EDITADO",
                f"Cambió la observación de {etiqueta}",
                {"campo": "nota", "anterior": detalle.nota, "nuevo": nota.strip()},
            ))
            detalle.nota = nota.strip()

        if not eventos:
            return False

        detalle.cantidad = cantidad
        detalle.precio_unitario = precio_unitario
        if legado:
            detalle.fue_modificado = True
            detalle.modificado_por = usuario
        detalle.save()

        for tipo, descripcion, datos in eventos:
            auditoria.registrar(
                pedido,
                tipo,
                descripcion,
                usuario=usuario,
                producto=etiqueta,
                origen=detalle.origen,
                **datos,
            )
        return True

    def _crear_linea(self, pedido, item, usuario):
        nombre = (item.get("nombre_producto") or "").strip()
        nueva_presentacion = item.get("presentacion")
        if bool(nueva_presentacion) == bool(nombre):
            raise serializers.ValidationError(
                "Cada producto nuevo debe ser de catálogo (con presentación) "
                "o personalizado (con nombre), no ambos ni ninguno."
            )
        if nueva_presentacion:
            _exigir_presentacion_vendible(nueva_presentacion)
        detalle = DetallePedido(
            pedido=pedido,
            presentacion=nueva_presentacion,
            nombre_personalizado=nombre or None,
            unidad_personalizada=None if nueva_presentacion else item.get("unidad_personalizada"),
            categoria_manual=None if nueva_presentacion else item.get("categoria_manual"),
            cantidad=item["cantidad"],
            precio_unitario=item["precio_unitario"],
            es_catalogo=bool(nueva_presentacion),
            origen="ADMIN",
            agregado_por=usuario,
            nota=(item.get("nota") or "").strip(),
        )
        detalle.save()
        return detalle

    def _aplicar_entrega(self, pedido, validated_data, usuario, auditoria) -> bool:
        hubo_cambios = False
        cambios = []
        for campo, etiqueta in CAMPOS_ENTREGA.items():
            if campo not in validated_data:
                continue
            nuevo = validated_data[campo]
            if isinstance(nuevo, str):
                nuevo = nuevo.strip()
            anterior = getattr(pedido, campo)
            if campo == "direccion_entrega" and nuevo == (
                pedido.cliente.direccion_cliente.strip() if pedido.cliente else ""
            ):
                # Igual a la del cliente = no es una dirección puntual (mismo
                # criterio que al crear el pedido).
                nuevo = ""
            if anterior == nuevo:
                continue
            cambios.append(
                {
                    "campo": campo,
                    "etiqueta": etiqueta,
                    "anterior": anterior.isoformat() if hasattr(anterior, "isoformat") else (anterior or ""),
                    "nuevo": nuevo.isoformat() if hasattr(nuevo, "isoformat") else (nuevo or ""),
                }
            )
            setattr(pedido, campo, nuevo)
        if cambios:
            nombres = ", ".join(c["etiqueta"].lower() for c in cambios)
            auditoria.registrar(
                pedido, "ENTREGA", f"Actualizó {nombres}", usuario=usuario, cambios=cambios
            )
            hubo_cambios = True

        if "notas_internas" in validated_data:
            nuevo = validated_data["notas_internas"].strip()
            if nuevo != pedido.notas_internas:
                auditoria.registrar(
                    pedido,
                    "NOTAS",
                    "Actualizó las notas internas",
                    usuario=usuario,
                    anterior=pedido.notas_internas,
                    nuevo=nuevo,
                )
                pedido.notas_internas = nuevo
                hubo_cambios = True

        # Las observaciones son las del CLIENTE. El panel ya no las edita, pero
        # el endpoint las aceptaba: si alguien las cambia, queda constancia.
        if "observaciones" in validated_data:
            nuevo = validated_data["observaciones"]
            if nuevo != (pedido.observaciones or ""):
                auditoria.registrar(
                    pedido,
                    "NOTAS",
                    "Modificó las observaciones del cliente",
                    usuario=usuario,
                    anterior=pedido.observaciones or "",
                    nuevo=nuevo,
                )
                pedido.observaciones = nuevo
                hubo_cambios = True
        return hubo_cambios

    def to_representation(self, instance):
        return {
            "success": True,
            "total": instance.total_pedido,
            "pedido": PedidoDetailSerializer(instance, context=self.context).data,
        }


# ==========================================================================
# HISTORIAL DE CAMBIOS POR PEDIDO
# ==========================================================================
def _exigir_presentacion_vendible(presentacion):
    """
    Una presentación desactivada no entra en líneas NUEVAS de un pedido.

    Las líneas que ya la tenían se quedan como están: desactivar una
    presentación no puede reescribir pedidos que ya se hicieron.
    """
    if not (presentacion.estado_presentacion and presentacion.producto.estado_producto):
        raise serializers.ValidationError(
            f"{_etiqueta_presentacion(presentacion)} está desactivada y no se puede "
            "agregar a un pedido."
        )


def _etiqueta_presentacion(presentacion):
    return (
        f"{presentacion.producto.nombre_producto} · {presentacion.nombre_presentacion} "
        f"({presentacion.unidad_venta.abreviatura_unidad})"
    )


CAMPO_ETIQUETAS = {
    "cantidad": "Cantidad",
    "precio_unitario": "Precio unitario",
    "nombre_personalizado": "Nombre del producto",
    "presentacion": "Presentación",
    "unidad_personalizada": "Unidad de venta",
}


class HistorialDetallePedidoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_usuario", read_only=True)
    producto_nombre = serializers.SerializerMethodField()
    campo_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = HistorialDetallePedido
        fields = [
            "id",
            "detalle",
            "producto_nombre",
            "campo",
            "campo_etiqueta",
            "valor_anterior",
            "valor_nuevo",
            "usuario",
            "usuario_nombre",
            "fecha",
            "motivo",
        ]

    def get_producto_nombre(self, obj):
        detalle = obj.detalle
        if detalle.presentacion_id:
            return detalle.presentacion.producto.nombre_producto
        return detalle.nombre_personalizado or "Personalizado"

    def get_campo_etiqueta(self, obj):
        return CAMPO_ETIQUETAS.get(obj.campo, obj.campo)


# ==========================================================================
# LOTES DE PEDIDOS (impresión/entrega masiva)
# ==========================================================================
class LoteSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_usuario", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = LotePedidos
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "usuario",
            "usuario_nombre",
            "cantidad_pedidos",
            "total_lote",
            "fecha_creacion",
        ]


class LoteDetailSerializer(LoteSerializer):
    pedidos = serializers.SerializerMethodField()

    class Meta(LoteSerializer.Meta):
        fields = LoteSerializer.Meta.fields + ["pedidos"]

    def get_pedidos(self, obj):
        pedidos = (
            obj.pedidos.select_related("cliente")
            .annotate(num_items=Count("detalles"))
            .order_by("-fecha_pedido")
        )
        return PedidoListSerializer(pedidos, many=True).data
