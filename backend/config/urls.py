from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    # API REST — un prefijo por dominio de negocio
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/contact/", include("apps.contact.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/media/", include("apps.media.urls")),
]

# Servir archivos multimedia en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
