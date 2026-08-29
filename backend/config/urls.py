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

    # El panel de Crynex: planes, permisos y negocios. Va bajo su propio
    # prefijo para que la separacion del punto 9 se lea en la URL.
    path("api/platform/", include("apps.billing.urls")),
]

if getattr(settings, "USE_R2", False):
    # Los archivos viven en Cloudflare R2 y se sirven desde su dominio publico:
    # Django no interviene, asi que no hay ninguna ruta /media/ que montar.
    pass
elif settings.DEBUG:
    # Servir archivos multimedia en desarrollo
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # WhiteNoise sirve /static/, pero NO /media/ (lo que suben los usuarios).
    # Sin esta ruta las imagenes de productos y categorias darian 404 en
    # produccion, porque el helper static() de arriba devuelve [] con DEBUG=False.
    #
    # serve_static no es eficiente para trafico alto, pero para el volumen de
    # este catalogo es suficiente. Es solo el camino de respaldo: en cuanto se
    # configuren las credenciales de Cloudflare R2 (ver USE_R2 en base.py) los
    # archivos se sirven desde el dominio del bucket y esta rama no se usa.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve_static,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
