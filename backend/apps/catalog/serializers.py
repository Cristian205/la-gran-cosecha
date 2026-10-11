from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F
from rest_framework import serializers

from apps.tenancy.fields import ClaveDelNegocio

from . import cantidades
from .models import Categoria, HistorialPrecio, PresentacionProducto, Producto, UnidadMedida


class CategoriaSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()
    # Lo anota `CategoriaViewSet`; fuera de esa consulta no existe y sale null.
    num_productos = serializers.SerializerMethodField()

    class Meta:
        model = Categoria
        fields = [
            "id",
            "nombre_categoria",
            "abreviatura",
            "orden",
            "estado_categoria",
            "imagen",
            "imagen_url",
            "subtitulo",
            "cta_texto",
            "num_productos",
        ]
        extra_kwargs = {"imagen": {"write_only": True, "required": False}}

    def get_num_productos(self, obj):
        return getattr(obj, "num_productos", None)

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url


class UnidadMedidaSerializer(serializers.ModelSerializer):
    # Solo con `?en_catalogo=1` (ver `UnidadMedidaViewSet`); si no, null.
    num_productos = serializers.SerializerMethodField()

    class Meta:
        model = UnidadMedida
        fields = ["id", "nombre_unidad", "abreviatura_unidad", "estado_unidad", "num_productos"]

    def get_num_productos(self, obj):
        return getattr(obj, "num_productos", None)

    def validate_nombre_unidad(self, valor):
        nombre = " ".join(valor.split())
        if not nombre:
            raise serializers.ValidationError("Escribe el nombre de la unidad.")
        # "Kilogramo" y "kilogramo" son la misma unidad. Sin esta comprobación
        # el duplicado exacto llegaba a la restricción única de la base como
        # un error 500.
        otras = UnidadMedida.objects.all()
        if self.instance:
            otras = otras.exclude(pk=self.instance.pk)
        if any(u.nombre_unidad.casefold() == nombre.casefold() for u in otras):
            raise serializers.ValidationError("Ya existe una unidad con ese nombre.")
        return nombre

    def validate_abreviatura_unidad(self, valor):
        abreviatura = valor.strip()
        if not abreviatura:
            raise serializers.ValidationError("Escribe la abreviatura (ej: kg).")
        return abreviatura


class PresentacionProductoSerializer(serializers.ModelSerializer):
    unidad_venta_nombre = serializers.CharField(
        source="unidad_venta.nombre_unidad", read_only=True
    )
    unidad_venta_abreviatura = serializers.CharField(
        source="unidad_venta.abreviatura_unidad", read_only=True
    )
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = PresentacionProducto
        fields = [
            "id",
            "producto",
            "nombre_presentacion",
            "unidad_venta",
            "unidad_venta_nombre",
            "unidad_venta_abreviatura",
            "factor_conversion",
            "precio_unitario",
            "estado_presentacion",
            # La regla de cantidad (ver `catalog/cantidades.py`): la tienda la
            # usa para el selector de cantidad y el pedido la vuelve a validar.
            "cantidad_minima",
            "incremento_cantidad",
            "decimales_cantidad",
            "orden",
            "version",
            # En qué se diferencia esta presentación de sus hermanas: talla,
            # color, empaque. Viaja tal cual porque quien sabe qué ejes tiene
            # este negocio es su perfil, no este serializer.
            "atributos",
            "imagen_url",
        ]
        read_only_fields = fields

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        url = obj.imagen.url
        return request.build_absolute_uri(url) if request else url


class ProductoSerializer(serializers.ModelSerializer):
    """Lectura de producto con sus presentaciones activas (para storefront/admin)."""

    categoria_nombre = serializers.CharField(
        source="categoria.nombre_categoria", read_only=True
    )
    unidad_base_nombre = serializers.CharField(
        source="unidad_base.nombre_unidad", read_only=True, default=None
    )
    imagen_url = serializers.SerializerMethodField()
    presentaciones = serializers.SerializerMethodField()
    # Cuántas presentaciones tiene el producto, activas e inactivas. Salen del
    # mismo prefetch que `presentaciones`: la tarjeta del panel dice "3
    # presentaciones · 1 inactiva" sin otra consulta por producto.
    num_presentaciones = serializers.SerializerMethodField()
    num_presentaciones_inactivas = serializers.SerializerMethodField()
    precio_desde = serializers.SerializerMethodField()
    # Lo pone la anotacion de la vista. Sale como cadena decimal y no como
    # booleano "hay/no hay" porque la tienda quiere poder decir "quedan 3",
    # que es lo que mueve a comprar, y el panel quiere el numero exacto.
    disponible = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True, required=False
    )

    class Meta:
        model = Producto
        fields = [
            "id",
            "codigo_producto",
            "nombre_producto",
            "slug",
            "categoria",
            "categoria_nombre",
            "unidad_base",
            "unidad_base_nombre",
            "tipo_cantidad",
            "permite_fraccion",
            "estado_producto",
            "imagen_url",
            "orden",
            "precio_desde",
            "presentaciones",
            "num_presentaciones",
            "num_presentaciones_inactivas",
            "controla_stock",
            "codigo_barras",
            "disponible",
        ]

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        url = obj.imagen.url
        return request.build_absolute_uri(url) if request else url

    def get_presentaciones(self, obj):
        # Solo presentaciones activas; el prefetch se resuelve en la vista.
        activas = [p for p in obj.presentaciones.all() if p.estado_presentacion]
        return PresentacionProductoSerializer(activas, many=True, context=self.context).data

    def get_num_presentaciones(self, obj):
        return sum(1 for p in obj.presentaciones.all() if p.estado_presentacion)

    def get_num_presentaciones_inactivas(self, obj):
        return sum(1 for p in obj.presentaciones.all() if not p.estado_presentacion)

    def get_precio_desde(self, obj):
        """
        Precio más bajo entre las presentaciones activas ("Desde $X" en la
        tienda). Usa la anotación de ProductoViewSet cuando está disponible y,
        si el serializer se llama desde otro sitio (p.ej. más-vendidos), lo
        calcula sobre el prefetch para no disparar consultas extra.
        """
        anotado = getattr(obj, "precio_desde", None)
        if anotado is not None:
            return str(anotado)
        precios = [
            p.precio_unitario for p in obj.presentaciones.all() if p.estado_presentacion
        ]
        return str(min(precios)) if precios else None


def normalizar_nombre(nombre: str) -> str:
    """Quita espacios sobrantes: "  Caja   x 12 " pasa a "Caja x 12"."""
    return " ".join((nombre or "").split())


def _clave_duplicado(nombre: str, unidad_id) -> tuple[str, int]:
    # "Caja" y "caja" en la misma unidad son la misma presentación para quien
    # compra; la restricción única de la base distingue mayúsculas, así que la
    # regla de verdad es esta y la base es el último seguro.
    return normalizar_nombre(nombre).casefold(), int(unidad_id)


def validar_campos_presentacion(datos: dict) -> dict[str, str]:
    """
    Lo que se puede comprobar de una presentación sin mirar a sus hermanas.

    `datos` trae los valores finales (los de la petición sobre los guardados),
    así que una edición parcial se valida igual que un alta completa.
    """
    errores = {}
    if not normalizar_nombre(datos.get("nombre_presentacion")):
        errores["nombre_presentacion"] = "Escribe el nombre de la presentación."
    if datos.get("unidad_venta") is None:
        errores["unidad_venta"] = "Elige la unidad en la que se vende."
    precio = datos.get("precio_unitario")
    if precio is None:
        errores["precio_unitario"] = "Escribe el precio de venta."
    elif precio < 0:
        errores["precio_unitario"] = "El precio no puede ser negativo."
    elif precio == 0:
        # Ningún flujo del negocio sabe vender a $0 (la tienda pintaría
        # "$0" y el pedido valdría cero): se exige un precio real.
        errores["precio_unitario"] = "El precio debe ser mayor que cero."
    factor = datos.get("factor_conversion")
    if factor is not None and factor <= 0:
        errores["factor_conversion"] = "La equivalencia debe ser mayor que cero."
    errores.update(
        cantidades.validar_regla(
            datos.get("cantidad_minima"),
            datos.get("incremento_cantidad"),
            datos.get("decimales_cantidad"),
        )
    )
    return errores


class ConflictoDeVersion(serializers.ValidationError):
    """Alguien guardó la presentación después de que este usuario la abriera."""

    status_code = 409
    default_detail = (
        "Otra persona modificó esta presentación mientras la editabas. "
        "Vuelve a abrirla para ver los cambios."
    )
    default_code = "conflicto"


class PresentacionGestionSerializer(serializers.ModelSerializer):
    """
    Alta y edición de UNA presentación desde el panel.

    Es el camino del editor de producto para productos que ya existen: cada
    presentación se guarda sola, sin reenviar el producto entero, así que
    guardarla no pisa los demás cambios del formulario ni los de otra persona
    que esté editando otra presentación del mismo producto.
    """

    producto = ClaveDelNegocio(Producto)
    unidad_venta = ClaveDelNegocio(UnidadMedida)
    nombre_presentacion = serializers.CharField(max_length=200, allow_blank=True)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    factor_conversion = serializers.DecimalField(
        max_digits=10, decimal_places=3, required=False
    )
    cantidad_minima = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )
    incremento_cantidad = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )
    decimales_cantidad = serializers.IntegerField(required=False)
    orden = serializers.IntegerField(required=False, min_value=0)
    #: La versión que el usuario leyó. Si no coincide con la guardada, 409.
    version = serializers.IntegerField(required=False)

    class Meta:
        model = PresentacionProducto
        fields = [
            "producto",
            "nombre_presentacion",
            "unidad_venta",
            "factor_conversion",
            "precio_unitario",
            "estado_presentacion",
            "cantidad_minima",
            "incremento_cantidad",
            "decimales_cantidad",
            "orden",
            "version",
        ]
        # El nombre único lo valida `validate` con una regla más estricta que
        # la de la base (sin distinguir mayúsculas); el validador automático
        # de DRF para `unique_together` exigiría además enviar los tres campos
        # en cada PATCH.
        validators = []

    def validate(self, attrs):
        instancia = self.instance
        producto = attrs.get("producto") or (instancia.producto if instancia else None)
        if instancia and "producto" in attrs and attrs["producto"].pk != instancia.producto_id:
            raise serializers.ValidationError(
                {"producto": "Una presentación no se puede mover a otro producto."}
            )

        # Valores finales: lo que llega sobre lo guardado (o, en un alta que
        # no manda la regla de cantidad, la que tenía el producto).
        if instancia:
            base = {
                campo: getattr(instancia, campo)
                for campo in (
                    "nombre_presentacion",
                    "unidad_venta",
                    "precio_unitario",
                    "factor_conversion",
                    "cantidad_minima",
                    "incremento_cantidad",
                    "decimales_cantidad",
                )
            }
        else:
            base = {"factor_conversion": Decimal("1"), **cantidades.regla_por_defecto(producto)}
        finales = {**base, **attrs}

        errores = validar_campos_presentacion(finales)
        if instancia:
            # Al editar solo se reclama lo que se está cambiando. Hay datos
            # guardados de antes de estas reglas (un precio en $0, por
            # ejemplo) y no pueden impedir desactivar, reactivar u ordenar
            # esa presentación; en cuanto se toque el precio, sí se exige.
            regla = {"cantidad_minima", "incremento_cantidad", "decimales_cantidad"}
            toca_regla = bool(regla & attrs.keys())
            errores = {
                campo: mensaje
                for campo, mensaje in errores.items()
                if campo in attrs or (campo in regla and toca_regla)
            }

        unidad = attrs.get("unidad_venta")
        if unidad is not None and not unidad.estado_unidad and (
            instancia is None or instancia.unidad_venta_id != unidad.pk
        ):
            errores.setdefault(
                "unidad_venta", "Esa unidad está desactivada. Elige otra o actívala primero."
            )

        cambia_identidad = instancia is None or bool(
            {"nombre_presentacion", "unidad_venta"} & attrs.keys()
        )
        if not errores and producto is not None and cambia_identidad:
            clave =_clave_duplicado(finales["nombre_presentacion"], finales["unidad_venta"].pk)
            hermanas = PresentacionProducto.objects.filter(
                producto=producto, unidad_venta=finales["unidad_venta"]
            )
            if instancia:
                hermanas = hermanas.exclude(pk=instancia.pk)
            for otra in hermanas:
                if _clave_duplicado(otra.nombre_presentacion, otra.unidad_venta_id) == clave:
                    errores["nombre_presentacion"] = (
                        "Ya existe una presentación con este nombre y esta unidad."
                        if otra.estado_presentacion
                        else "Ya existe una presentación inactiva con este nombre y esta "
                        "unidad. Actívala en lugar de crear otra."
                    )
                    break

        if errores:
            raise serializers.ValidationError(errores)

        if "nombre_presentacion" in attrs:
            attrs["nombre_presentacion"] = normalizar_nombre(attrs["nombre_presentacion"])
        if instancia is None:
            for campo in (
                "factor_conversion",
                "cantidad_minima",
                "incremento_cantidad",
                "decimales_cantidad",
            ):
                attrs.setdefault(campo, finales[campo])
        return attrs

    def _guardar(self, guardar):
        try:
            with transaction.atomic():
                return guardar()
        except IntegrityError:
            # Dos altas iguales a la vez: `validate` no vio a la otra porque
            # aún no existía. La base la frena; aquí se traduce.
            raise serializers.ValidationError(
                {"nombre_presentacion": "Ya existe una presentación con este nombre y esta unidad."}
            )

    def create(self, validated_data):
        validated_data.pop("version", None)
        if "orden" not in validated_data:
            ultima = (
                PresentacionProducto.objects.filter(producto=validated_data["producto"])
                .order_by("-orden")
                .first()
            )
            validated_data["orden"] = (ultima.orden + 1) if ultima else 0
        return self._guardar(
            lambda: super(PresentacionGestionSerializer, self).create(validated_data)
        )

    def update(self, instance, validated_data):
        version_leida = validated_data.pop("version", None)
        validated_data.pop("producto", None)

        def guardar():
            # Se relee bloqueada: la comparación de versión y la escritura
            # tienen que ser una sola operación, o dos guardados simultáneos
            # verían ambos la versión vieja y el segundo pisaría al primero.
            actual = PresentacionProducto.objects.select_for_update().get(pk=instance.pk)
            if version_leida is not None and version_leida != actual.version:
                raise ConflictoDeVersion()
            precio = validated_data.get("precio_unitario")
            if precio is not None and precio != actual.precio_unitario:
                HistorialPrecio.objects.create(
                    presentacion=actual,
                    precio_anterior=actual.precio_unitario,
                    precio_nuevo=precio,
                    usuario=self.context["request"].user,
                )
            for campo, valor in validated_data.items():
                setattr(actual, campo, valor)
            actual.save()
            return actual

        return self._guardar(guardar)

    def to_representation(self, instance):
        return PresentacionProductoSerializer(instance, context=self.context).data


class PresentacionWriteSerializer(serializers.Serializer):
    """
    Entrada de una presentación al crear/editar un producto (guardado anidado).

    Lo usan el alta de un producto nuevo —sus presentaciones nacen en la misma
    transacción, así que no quedan huérfanas si algo falla— y la aprobación de
    productos personalizados. La regla de cantidad es opcional para no romper
    a quien todavía no la envía: sin ella, se hereda la del producto.
    """

    id = serializers.IntegerField(required=False, allow_null=True)
    nombre_presentacion = serializers.CharField(max_length=200, allow_blank=True)
    unidad_venta = ClaveDelNegocio(UnidadMedida)
    factor_conversion = serializers.DecimalField(
        max_digits=10, decimal_places=3, default=Decimal("1")
    )
    precio_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0")
    )
    cantidad_minima = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )
    incremento_cantidad = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )
    decimales_cantidad = serializers.IntegerField(required=False)
    estado_presentacion = serializers.BooleanField(required=False)


class ProductoWriteSerializer(serializers.ModelSerializer):
    """
    Crea/edita un producto junto a sus presentaciones anidadas.
    Replica la lógica de `gestion_catalogo` (upsert de presentaciones,
    desactivación de las eliminadas y registro de HistorialPrecio).

    `presentaciones` es opcional: el editor del panel ya no lo manda al editar
    un producto existente (cada presentación se guarda por su endpoint), y un
    PATCH sin él deja las presentaciones como están.
    """

    presentaciones = PresentacionWriteSerializer(many=True, required=False)

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre_producto",
            "categoria",
            "unidad_base",
            "tipo_cantidad",
            "permite_fraccion",
            "estado_producto",
            "controla_stock",
            "codigo_barras",
            "presentaciones",
        ]

    def validate(self, attrs):
        presentaciones = attrs.get("presentaciones")
        if presentaciones is None:
            return attrs

        # La regla por defecto sale del producto TAL COMO QUEDARÁ: el de la
        # base con lo que cambie esta petición.
        producto = Producto(
            permite_fraccion=attrs.get(
                "permite_fraccion", getattr(self.instance, "permite_fraccion", False)
            ),
            tipo_cantidad=attrs.get(
                "tipo_cantidad", getattr(self.instance, "tipo_cantidad", "entero")
            ),
        )
        existentes = (
            {p.id: p for p in self.instance.presentaciones.all()} if self.instance else {}
        )

        errores, vistas, hay_errores = [], {}, False
        for i, pres in enumerate(presentaciones):
            # Fila vacía del formulario viejo: se ignora, como siempre.
            if not normalizar_nombre(pres.get("nombre_presentacion")):
                errores.append({})
                continue
            guardada = existentes.get(pres.get("id"))
            if guardada:
                por_defecto = {
                    "cantidad_minima": guardada.cantidad_minima,
                    "incremento_cantidad": guardada.incremento_cantidad,
                    "decimales_cantidad": guardada.decimales_cantidad,
                }
            else:
                por_defecto = cantidades.regla_por_defecto(producto)
            for campo, valor in por_defecto.items():
                pres.setdefault(campo, valor)

            fila = validar_campos_presentacion(pres)
            clave = _clave_duplicado(pres["nombre_presentacion"], pres["unidad_venta"].pk)
            if not fila and clave in vistas:
                fila["nombre_presentacion"] = (
                    f"Repite el nombre y la unidad de la presentación {vistas[clave] + 1}."
                )
            vistas.setdefault(clave, i)
            errores.append(fila)
            hay_errores = hay_errores or bool(fila)

        if hay_errores:
            raise serializers.ValidationError({"presentaciones": errores})
        return attrs

    def _sync_presentaciones(self, producto, presentaciones):
        usuario = self.context["request"].user
        ids_recibidos = []

        for orden, pres in enumerate(presentaciones):
            nombre = normalizar_nombre(pres["nombre_presentacion"])
            if not nombre:
                continue

            factor = pres.get("factor_conversion") or Decimal("1")
            precio = pres.get("precio_unitario") or Decimal("0")
            regla = {
                campo: pres[campo]
                for campo in ("cantidad_minima", "incremento_cantidad", "decimales_cantidad")
            }
            activa = pres.get("estado_presentacion", True)
            pres_id = pres.get("id")

            if pres_id:
                try:
                    presentacion = producto.presentaciones.get(id=pres_id)
                except PresentacionProducto.DoesNotExist:
                    continue

                if presentacion.precio_unitario != precio:
                    HistorialPrecio.objects.create(
                        presentacion=presentacion,
                        precio_anterior=presentacion.precio_unitario,
                        precio_nuevo=precio,
                        usuario=usuario,
                    )

                presentacion.nombre_presentacion = nombre
                presentacion.unidad_venta = pres["unidad_venta"]
                presentacion.factor_conversion = factor
                presentacion.precio_unitario = precio
                presentacion.estado_presentacion = activa
                presentacion.orden = orden
                for campo, valor in regla.items():
                    setattr(presentacion, campo, valor)
                presentacion.save()
                ids_recibidos.append(presentacion.id)
            else:
                nueva = PresentacionProducto.objects.create(
                    producto=producto,
                    nombre_presentacion=nombre,
                    unidad_venta=pres["unidad_venta"],
                    factor_conversion=factor,
                    precio_unitario=precio,
                    estado_presentacion=activa,
                    orden=orden,
                    **regla,
                )
                ids_recibidos.append(nueva.id)

        # Desactivar (borrado lógico) las presentaciones que ya no vienen.
        # Nunca se borran: los pedidos y facturas viejos las referencian.
        producto.presentaciones.exclude(id__in=ids_recibidos).filter(
            estado_presentacion=True
        ).update(estado_presentacion=False, version=F("version") + 1)

    @transaction.atomic
    def create(self, validated_data):
        presentaciones = validated_data.pop("presentaciones", [])
        self._aplicar_perfil(validated_data)
        producto = Producto.objects.create(**validated_data)
        self._sync_presentaciones(producto, presentaciones)
        return producto

    def _aplicar_perfil(self, datos):
        """
        Cómo nace un producto según lo que este negocio hace.

        Solo rellena lo que la petición NO trae: quien manda un valor explícito
        manda, siempre. Y solo al crear, nunca al editar — un producto que ya
        existe no puede cambiar de comportamiento porque alguien tocara el
        perfil del negocio tres meses después.

        Es la única forma en que una capacidad debe influir en el catálogo:
        proponiendo el valor inicial, no imponiéndolo.
        """
        from apps.business.consulta import puede  # noqa: PLC0415

        peticion = self.context.get("request")
        tenant = getattr(peticion, "tenant", None)
        if tenant is None:
            return

        if "controla_stock" not in datos:
            datos["controla_stock"] = puede(tenant, "controla_stock")
        if "permite_fraccion" not in datos:
            datos["permite_fraccion"] = puede(tenant, "vende_por_peso")

    @transaction.atomic
    def update(self, instance, validated_data):
        presentaciones = validated_data.pop("presentaciones", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if presentaciones is not None:
            self._sync_presentaciones(instance, presentaciones)
        return instance

    def to_representation(self, instance):
        return ProductoSerializer(instance, context=self.context).data


class HistorialPrecioSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(
        source="usuario.nombre_usuario", read_only=True
    )
    usuario_rol = serializers.CharField(
        source="usuario.rol_usuario", read_only=True
    )
    presentacion_nombre = serializers.CharField(
        source="presentacion.nombre_presentacion", read_only=True
    )

    class Meta:
        model = HistorialPrecio
        fields = [
            "id",
            "presentacion",
            "presentacion_nombre",
            "precio_anterior",
            "precio_nuevo",
            "usuario",
            "usuario_nombre",
            "usuario_rol",
            "fecha_cambio",
        ]
