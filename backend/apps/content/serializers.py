from rest_framework import serializers

from .models import PromoBanner, SiteConfig, Testimonio, TrustBadge


class SiteConfigSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = SiteConfig
        fields = [
            "logo",
            "logo_url",
            "nombre_empresa",
            "color_primario",
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
        fields = ["id", "icono", "valor", "etiqueta", "orden", "activo"]
