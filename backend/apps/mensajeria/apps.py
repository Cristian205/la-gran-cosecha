from django.apps import AppConfig


class MensajeriaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.mensajeria"
    label = "mensajeria"
    verbose_name = "Mensajería (WhatsApp)"

    def ready(self):
        from . import disparadores  # noqa: F401
