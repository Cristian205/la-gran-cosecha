from rest_framework import serializers

from apps.catalog.serializers import PresentacionProductoSerializer

from .models import BeneficioComercial, OfertaProducto, PromoBanner, SiteConfig, Testimonio, TrustBadge


class SiteConfigSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SiteConfig
        fields = [
            "logo",
            "logo_url",
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
        ]
        extra_kwargs = {"logo": {"write_only": True, "required": False}}

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url


class PromoBannerSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = PromoBanner
        fields = [
            "id",
            "imagen",
            "imagen_url",
            "etiqueta",
            "titulo",
            "texto",
            "cta_texto",
            "cta_href",
            "orden",
            "activo",
        ]
        extra_kwargs = {"imagen": {"write_only": True, "required": False}}

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url


class TestimonioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonio
        fields = ["id", "nombre", "rol", "texto", "estrellas", "orden", "activo"]


class TrustBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustBadge
        fields = ["id", "tipo", "icono", "valor", "etiqueta", "orden", "activo"]


class BeneficioComercialSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeneficioComercial
        fields = ["id", "icono", "titulo", "texto", "orden", "activo"]


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
