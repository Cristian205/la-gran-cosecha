from django.apps import AppConfig


class ReservationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.reservations"
    label = "reservations"
    verbose_name = "Reservas"

    def ready(self):
        # Registra el panel que este módulo aporta a la caja. Va aquí y no en
        # el POS por la razón de ser del registro: el punto de venta no debe
        # enterarse de que existen las reservas. Ver `reservations/paneles.py`.
        from . import paneles  # noqa: F401  — el import ES el registro
