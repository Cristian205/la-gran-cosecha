from django.apps import AppConfig


class TenancyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tenancy"
    verbose_name = "Multiempresa"

    def ready(self):
        from . import signals  # noqa: F401,PLC0415
