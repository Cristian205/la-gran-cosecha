from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BeneficioComercialViewSet,
    OfertaProductoViewSet,
    PromoBannerViewSet,
    SiteConfigView,
    TestimonioViewSet,
    TrustBadgeViewSet,
)

router = DefaultRouter()
router.register(r"banners", PromoBannerViewSet, basename="banners")
router.register(r"testimonials", TestimonioViewSet, basename="testimonials")
router.register(r"trust-badges", TrustBadgeViewSet, basename="trust-badges")
router.register(r"beneficios", BeneficioComercialViewSet, basename="beneficios")
router.register(r"ofertas", OfertaProductoViewSet, basename="ofertas")

urlpatterns = [
    path("site-config/", SiteConfigView.as_view(), name="site-config"),
]

urlpatterns += router.urls
