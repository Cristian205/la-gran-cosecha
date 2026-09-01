from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import NotFound
from rest_framework import permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import EsStaff
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from .models import BeneficioComercial, OfertaProducto, PromoBanner, StoreSettings, Testimonio, TrustBadge
from .serializers import (
    BeneficioComercialSerializer,
    OfertaProductoSerializer,
    PromoBannerSerializer,
    SiteConfigSerializer,
    TestimonioSerializer,
    TrustBadgeSerializer,
)


class SiteConfigView(ExigeNegocioMixin, APIView):
    """
    Configuración de la tienda del negocio de esta petición. Lectura pública
    (la storefront la consume sin autenticación); escritura solo staff.

    La ruta sigue llamándose `site-config` para no tocar el storefront, aunque
    el modelo detrás ya sea `StoreSettings` y haya una fila por negocio.
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [EsStaff()]

    def _config(self, request):
        config = StoreSettings.get_para(getattr(request, "tenant", None))
        if config is None:
            raise NotFound("No hay ningún negocio asociado a esta dirección.")
        return config

    def get(self, request):
        config = self._config(request)
        return Response(SiteConfigSerializer(config, context={"request": request}).data)

    def patch(self, request):
        config = self._config(request)
        serializer = SiteConfigSerializer(
            config, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class _ContenidoPublicoOStaffMixin(TenantScopedMixin):
    """
    Lectura pública solo de elementos activos; el staff ve y administra todo.

    `modelo` sustituye al atributo `queryset` de clase que había antes: ese se
    evaluaba al importar el módulo, y con el manager acotado eso ocurre fuera
    de toda petición, sin contexto de negocio. El modelo se declara y el
    queryset se construye ya dentro de la petición.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(activo=True)
        return qs

    def get_permissions(self):
        """
        Lectura abierta; escritura solo staff.

        Antes esto devolvía `[*super().get_permissions()[:1], *propios]`, con el
        comentario de que `super()` era «quien añade ExigePertenencia». No lo
        es: la pertenencia se exige en `check_permissions()`, que corre siempre
        y es independiente de este método. Lo que ese `[:1]` colaba era el
        `IsAuthenticated` de los permisos por defecto de DRF — y como DRF exige
        que TODOS pasen, `IsAuthenticated` + `AllowAny` significa autenticado.

        El efecto era que banderolas, insignias, beneficios, testimonios y
        ofertas respondían 401 a cualquier visitante anónimo: las tiendas se
        servían sin nada de eso y en silencio, porque cada bloque devuelve
        `null` cuando su lista viene vacía.
        """
        if self.request.method in permissions.SAFE_METHODS:
            return [AllowAny()]
        return [EsStaff()]


class PromoBannerViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = PromoBannerSerializer
    modelo = PromoBanner
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class TestimonioViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = TestimonioSerializer
    modelo = Testimonio


class TrustBadgeViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = TrustBadgeSerializer
    modelo = TrustBadge


class BeneficioComercialViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    serializer_class = BeneficioComercialSerializer
    modelo = BeneficioComercial


class OfertaProductoViewSet(_ContenidoPublicoOStaffMixin, viewsets.ModelViewSet):
    """
    Ofertas de la semana. Lectura pública filtra activas y no vencidas
    (fecha_fin nula o en el futuro); el staff ve y administra todas.
    """

    serializer_class = OfertaProductoSerializer
    modelo = OfertaProducto

    def get_queryset(self):
        qs = super().get_queryset().select_related(
            "presentacion__producto__categoria", "presentacion__unidad_venta"
        )
        if not (self.request.user and self.request.user.is_staff):
            vigente = Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=timezone.now())
            qs = qs.filter(activo=True).filter(vigente)
        return qs
