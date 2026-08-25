from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as serve_static

from .health import healthz

urlpatterns = [
    path("healthz", healthz),
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

if settings.DEBUG:
    # Servir archivos multimedia en desarrollo
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # WhiteNoise sirve /static/, pero NO /media/ (lo que suben los usuarios).
    # Sin esta ruta las imagenes de productos y categorias darian 404 en
    # produccion, porque el helper static() de arriba devuelve [] con DEBUG=False.
    #
    # serve_static no es eficiente para trafico alto, pero para el volumen de
    # este catalogo es suficiente. La solucion definitiva es mover media a un
    # almacenamiento externo (Supabase Storage / S3) con django-storages, que
    # ademas elimina la dependencia del disco persistente de Render.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve_static,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
