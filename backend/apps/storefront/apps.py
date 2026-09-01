from django.apps import AppConfig


class StorefrontConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.storefront"
    verbose_name = "Motor de tiendas"

    def ready(self):
        from . import signals  # noqa: F401,PLC0415
