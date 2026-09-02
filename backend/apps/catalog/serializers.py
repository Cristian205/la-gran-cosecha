from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.tenancy.fields import ClaveDelNegocio

from .models import Categoria, HistorialPrecio, PresentacionProducto, Producto, UnidadMedida


class CategoriaSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()

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
        ]
        extra_kwargs = {"imagen": {"write_only": True, "required": False}}

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadMedida
        fields = ["id", "nombre_unidad", "abreviatura_unidad", "estado_unidad"]


class PresentacionProductoSerializer(serializers.ModelSerializer):
    unidad_venta_nombre = serializers.CharField(
        source="unidad_venta.nombre_unidad", read_only=True
    )

    class Meta:
        model = PresentacionProducto
        fields = [
            "id",
            "nombre_presentacion",
            "unidad_venta",
            "unidad_venta_nombre",
            "factor_conversion",
            "precio_unitario",
            "estado_presentacion",
            # En qué se diferencia esta presentación de sus hermanas: talla,
            # color, empaque. Viaja tal cual porque quien sabe qué ejes tiene
            # este negocio es su perfil, no este serializer.
            "atributos",
        ]


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
        return PresentacionProductoSerializer(activas, many=True).data

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


class PresentacionWriteSerializer(serializers.Serializer):
    """Entrada de una presentación al crear/editar un producto."""

    id = serializers.IntegerField(required=False, allow_null=True)
    nombre_presentacion = serializers.CharField(max_length=200)
    unidad_venta = ClaveDelNegocio(UnidadMedida)
    factor_conversion = serializers.DecimalField(
        max_digits=10, decimal_places=3, default=Decimal("1")
    )
    precio_unitario = serializers.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0")
    )


class ProductoWriteSerializer(serializers.ModelSerializer):
    """
    Crea/edita un producto junto a sus presentaciones anidadas.
    Replica la lógica de `gestion_catalogo` (upsert de presentaciones,
    desactivación de las eliminadas y registro de HistorialPrecio).
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

    def _sync_presentaciones(self, producto, presentaciones):
        usuario = self.context["request"].user
        ids_recibidos = []

        for pres in presentaciones:
            nombre = pres["nombre_presentacion"].strip()
            if not nombre:
                continue

            factor = pres.get("factor_conversion") or Decimal("1")
            precio = pres.get("precio_unitario") or Decimal("0")
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
                presentacion.estado_presentacion = True
                presentacion.save()
                ids_recibidos.append(presentacion.id)
            else:
                nueva = PresentacionProducto.objects.create(
                    producto=producto,
                    nombre_presentacion=nombre,
                    unidad_venta=pres["unidad_venta"],
                    factor_conversion=factor,
                    precio_unitario=precio,
                    estado_presentacion=True,
                )
                ids_recibidos.append(nueva.id)

        # Desactivar (borrado lógico) las presentaciones que ya no vienen.
        producto.presentaciones.exclude(id__in=ids_recibidos).update(
            estado_presentacion=False
        )

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
