from rest_framework import serializers

from apps.catalog.serializers import PresentacionProductoSerializer

from .models import Anuncio, BeneficioComercial, OfertaProducto, PromoBanner, StoreSettings, Testimonio, TrustBadge


class SiteConfigSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    factura_logo_url = serializers.SerializerMethodField()
    variables_tema = serializers.SerializerMethodField()

    def get_variables_tema(self, obj):
        """
        Las variables CSS ya resueltas: catálogo, tema y negocio, en ese orden.

        Se resuelven aquí y no en la tienda porque la mezcla de tres capas es
        una regla del producto, no una decisión de presentación: si la repitiera
        el frontend, las dos versiones acabarían separándose.
        """
        from apps.storefront.tema import variables_css  # noqa: PLC0415

        return variables_css(obj)

    #: Si esta tienda recibe pedidos o es solo un catalogo.
    #:
    #: Viaja con la configuracion del sitio y no en un endpoint aparte porque
    #: la tienda ya la pide una vez por pagina: una segunda llamada solo para
    #: un booleano seria una peticion de red por cada visita.
    #:
    #: Es SOLO informativo: quien de verdad rechaza un pedido sin esta
    #: capacidad es el serializer de pedidos, en el servidor. Esconder el boton
    #: es cortesia con el cliente, no la comprobacion.
    acepta_pedidos_online = serializers.SerializerMethodField()

    def get_acepta_pedidos_online(self, obj) -> bool:
        from apps.business.consulta import puede  # noqa: PLC0415

        return puede(obj.tenant, "acepta_pedidos_online")

    class Meta:
        model = StoreSettings
        fields = [
            "logo",
            "logo_url",
            "tokens",
            "variables_tema",
            "acepta_pedidos_online",
            "nombre_empresa",
            "color_primario",
            "color_primario_texto",
            "color_secundario",
            "color_secundario_texto",
            "color_fondo",
            "color_superficie",
            "color_texto",
            "fuente",
            "radio_boton",
            "ancho_buscador",
            "espaciado_navbar",
            "whatsapp_numero",
            "whatsapp_mensaje_pedido",
            "instagram_url",
            "facebook_url",
            "tiktok_url",
            "telefono",
            "email",
            "direccion",
            "ciudad",
            "horario",
            "historia",
            "mision",
            "paso1_titulo",
            "paso1_texto",
            "paso2_titulo",
            "paso2_texto",
            "paso3_titulo",
            "paso3_texto",
            "cotizacion_titulo",
            "cotizacion_texto",
            "cta_final_titulo",
            "cta_final_texto",
            "factura_eslogan",
            "factura_nit",
            "factura_proveedor",
            "factura_telefono",
            "factura_direccion",
            "factura_logo",
            "factura_logo_url",
            "factura_aplicar_tinte_logo",
            "factura_marca_agua_activa",
            "factura_marca_agua_texto",
            "factura_marca_agua_opacidad",
            "factura_nota_pie",
            "factura_chip_secundario",
            "identificacion_clientes",
        ]
        extra_kwargs = {
            "logo": {"write_only": True, "required": False},
            "factura_logo": {"write_only": True, "required": False},
        }

    def validate_identificacion_clientes(self, valor):
        # "Usuario y contraseña" se enseña en el panel pero todavía no existe:
        # elegirla dejaría la tienda pidiendo un inicio de sesión que no hay.
        if valor not in StoreSettings.IDENTIFICACIONES_DISPONIBLES:
            raise serializers.ValidationError(
                "El inicio de sesión con usuario y contraseña todavía no está disponible."
            )
        return valor

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url

    def get_factura_logo_url(self, obj):
        if not obj.factura_logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.factura_logo.url) if request else obj.factura_logo.url


class _ImagenesMixin:
    """
    Subir, reemplazar y QUITAR imágenes desde el panel.

    Subir o reemplazar es mandar el archivo en su campo; quitar es mandar
    `quitar_<campo>=true`. Se borra también el archivo del bucket: una imagen
    retirada que sigue ocupando espacio no la puede encontrar nadie.
    """

    campos_imagen: tuple = ()

    def _quitar_imagenes(self, instance, datos):
        peticion = self.context.get("request")
        entrada = getattr(peticion, "data", {}) or {}
        for campo in self.campos_imagen:
            if str(entrada.get(f"quitar_{campo}", "")).lower() in ("1", "true", "si", "sí"):
                archivo = getattr(instance, campo)
                if archivo:
                    archivo.delete(save=False)
                setattr(instance, campo, None)
                datos.pop(campo, None)

    def update(self, instance, validated_data):
        self._quitar_imagenes(instance, validated_data)
        return super().update(instance, validated_data)


class PromoBannerSerializer(_ImagenesMixin, serializers.ModelSerializer):
    campos_imagen = ("imagen", "imagen_movil")
    imagen_url = serializers.SerializerMethodField()
    imagen_movil_url = serializers.SerializerMethodField()

    class Meta:
        model = PromoBanner
        fields = [
            "id",
            "imagen",
            "imagen_url",
            "imagen_movil",
            "imagen_movil_url",
            "fecha_inicio",
            "fecha_fin",
            "etiqueta",
            "titulo",
            "texto",
            "cta_texto",
            "cta_href",
            "orden",
            "activo",
        ]
        extra_kwargs = {
            "imagen": {"write_only": True, "required": False},
            "imagen_movil": {"write_only": True, "required": False},
        }

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url

    def get_imagen_movil_url(self, obj):
        if not obj.imagen_movil:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen_movil.url) if request else obj.imagen_movil.url


class AnuncioSerializer(_ImagenesMixin, serializers.ModelSerializer):
    campos_imagen = ("imagen", "imagen_movil")
    imagen_url = serializers.SerializerMethodField()
    imagen_movil_url = serializers.SerializerMethodField()

    class Meta:
        model = Anuncio
        fields = [
            "id",
            "imagen",
            "imagen_url",
            "imagen_movil",
            "imagen_movil_url",
            "fecha_inicio",
            "fecha_fin",
            "etiqueta",
            "titulo",
            "texto",
            "cta_texto",
            "cta_href",
            "orden",
            "activo",
        ]
        extra_kwargs = {
            "imagen": {"write_only": True, "required": False},
            "imagen_movil": {"write_only": True, "required": False},
        }

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url

    def get_imagen_movil_url(self, obj):
        if not obj.imagen_movil:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen_movil.url) if request else obj.imagen_movil.url


class TestimonioSerializer(_ImagenesMixin, serializers.ModelSerializer):
    campos_imagen = ("foto",)
    foto_url = serializers.SerializerMethodField()

    class Meta:
        model = Testimonio
        fields = ["id", "nombre", "rol", "texto", "estrellas", "foto", "foto_url", "orden", "activo"]
        extra_kwargs = {"foto": {"write_only": True, "required": False}}

    def get_foto_url(self, obj):
        return self._url(obj.foto)

    def _url(self, archivo):
        if not archivo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(archivo.url) if request else archivo.url


class TrustBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustBadge
        fields = ["id", "tipo", "icono", "valor", "etiqueta", "orden", "activo"]


class BeneficioComercialSerializer(_ImagenesMixin, serializers.ModelSerializer):
    campos_imagen = ("imagen",)
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = BeneficioComercial
        fields = ["id", "icono", "imagen", "imagen_url", "titulo", "texto", "orden", "activo"]
        extra_kwargs = {"imagen": {"write_only": True, "required": False}}

    def get_imagen_url(self, obj):
        return self._url(obj.imagen)

    def _url(self, archivo):
        if not archivo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(archivo.url) if request else archivo.url


class OfertaProductoSerializer(serializers.ModelSerializer):
    """
    Lectura pública para el bloque "Ofertas de la semana": el precio normal
    y el % de ahorro siempre se calculan en vivo desde el precio actual de
    la presentación, nunca se congelan en la oferta.
    """

    presentacion_detalle = PresentacionProductoSerializer(source="presentacion", read_only=True)
    producto_id = serializers.IntegerField(source="presentacion.producto.id", read_only=True)
    producto_nombre = serializers.CharField(source="presentacion.producto.nombre_producto", read_only=True)
    producto_imagen_url = serializers.SerializerMethodField()
    producto_categoria = serializers.IntegerField(source="presentacion.producto.categoria_id", read_only=True)
    producto_categoria_nombre = serializers.CharField(
        source="presentacion.producto.categoria.nombre_categoria", read_only=True
    )
    producto_permite_fraccion = serializers.BooleanField(
        source="presentacion.producto.permite_fraccion", read_only=True
    )
    producto_tipo_cantidad = serializers.CharField(
        source="presentacion.producto.tipo_cantidad", read_only=True
    )
    precio_normal = serializers.DecimalField(
        source="presentacion.precio_unitario", max_digits=12, decimal_places=2, read_only=True
    )
    porcentaje_ahorro = serializers.SerializerMethodField()

    class Meta:
        model = OfertaProducto
        fields = [
            "id",
            "presentacion",
            "presentacion_detalle",
            "producto_id",
            "producto_nombre",
            "producto_imagen_url",
            "producto_categoria",
            "producto_categoria_nombre",
            "producto_permite_fraccion",
            "producto_tipo_cantidad",
            "precio_normal",
            "precio_oferta",
            "porcentaje_ahorro",
            "fecha_fin",
            "activo",
            "fecha_creacion",
        ]

    def get_producto_imagen_url(self, obj):
        imagen = obj.presentacion.producto.imagen
        if not imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(imagen.url) if request else imagen.url

    def get_porcentaje_ahorro(self, obj):
        normal = obj.presentacion.precio_unitario
        if not normal:
            return 0
        ahorro = (normal - obj.precio_oferta) / normal * 100
        return round(float(ahorro))
