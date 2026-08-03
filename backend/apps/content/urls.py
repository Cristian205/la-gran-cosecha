from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PromoBannerViewSet, SiteConfigView, TestimonioViewSet, TrustBadgeViewSet

router = DefaultRouter()
router.register(r"banners", PromoBannerViewSet, basename="banners")
router.register(r"testimonials", TestimonioViewSet, basename="testimonials")
router.register(r"trust-badges", TrustBadgeViewSet, basename="trust-badges")

urlpatterns = [
    path("site-config/", SiteConfigView.as_view(), name="site-config"),
]

urlpatterns += router.urls
