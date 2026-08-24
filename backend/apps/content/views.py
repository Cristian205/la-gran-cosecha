from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import EsStaff

from .models import BeneficioComercial, OfertaProducto, PromoBanner, SiteConfig, Testimonio, TrustBadge
from .serializers import (
    BeneficioComercialSerializer,
    OfertaProductoSerializer,
    PromoBannerSerializer,
    SiteConfigSerializer,
    TestimonioSerializer,
    TrustBadgeSerializer,
)


class SiteConfigView(APIView):
    """
    Configuración única del sitio. Lectura pública (la storefront la consume
    sin autenticación); escritura solo staff (admin-panel).
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [EsStaff()]

    def get(self, request):
        config = SiteConfig.get_solo()
        return Response(SiteConfigSerializer(config, context={"request": request}).data)

    def patch(self, request):
        config = SiteConfig.get_solo()
        serializer = SiteConfigSerializer(
            config, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class _ContenidoPublicoOStaffMixin:
    """
    Lectura pública solo de elementos activos (ordenados); el staff ve y
    administra todo. Reutiliza el patrón ya usado en apps.catalog.
    """

    def get_queryset(self):
        qs = self.queryset.model.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(activo=True)
        return qs

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [EsStaff()]


class PromoBannerViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = PromoBannerSerializer
    queryset = PromoBanner.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class TestimonioViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = TestimonioSerializer
    queryset = Testimonio.objects.all()


class TrustBadgeViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = TrustBadgeSerializer
    queryset = TrustBadge.objects.all()


class BeneficioComercialViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = BeneficioComercialSerializer
    queryset = BeneficioComercial.objects.all()


class OfertaProductoViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    """
    Ofertas de la semana. Lectura pública filtra activas y no vencidas
    (fecha_fin nula o en el futuro); el staff ve y administra todas.
    """

    serializer_class = OfertaProductoSerializer
    queryset = OfertaProducto.objects.select_related(
        "presentacion__producto__categoria", "presentacion__unidad_venta"
    ).all()

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user and self.request.user.is_staff):
            vigente = Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=timezone.now())
            qs = qs.filter(activo=True).filter(vigente)
        return qs
