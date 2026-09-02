from django.apps import AppConfig


class BusinessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.business"
    label = "business"
    verbose_name = "Perfil de negocio"

    def ready(self):
        from . import signals  # noqa: F401,PLC0415
