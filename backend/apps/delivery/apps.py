from django.apps import AppConfig


class DeliveryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.delivery"
    label = "delivery"
    verbose_name = "Domicilios"

    def ready(self):
        # Registra el panel que este módulo aporta a la caja. Va aquí y no en
        # el POS por la misma razón que en reservas: el punto de venta no debe
        # enterarse de que existen los domicilios. Ver `delivery/paneles.py`.
        from . import paneles  # noqa: F401  — el import ES el registro
