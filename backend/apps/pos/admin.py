from django.contrib import admin

from .models import LineaVenta, MedioPago, Pago, Turno, Venta


@admin.register(MedioPago)
class MedioPagoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "tipo", "activo", "orden")
    list_filter = ("tipo", "activo")


@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = (
        "id", "ubicacion", "usuario_apertura", "fecha_apertura",
        "fecha_cierre", "diferencia",
    )
    list_filter = ("ubicacion",)
    readonly_fields = ("total_calculado", "diferencia")


class LineaInline(admin.TabularInline):
    model = LineaVenta
    extra = 0
    # El historico no se reescribe: una venta equivocada se anula, y la
    # anulacion devuelve la mercancia dejando las dos a la vista.
    readonly_fields = ("presentacion", "nombre_congelado", "cantidad",
                       "precio_unitario", "subtotal", "atributos", "nota")
    can_delete = False


class PagoInline(admin.TabularInline):
    model = Pago
    extra = 0
    readonly_fields = ("medio", "importe", "referencia", "fecha")
    can_delete = False


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ("__str__", "estado", "cliente", "total", "fecha")
    list_filter = ("estado", "turno")
    date_hierarchy = "fecha"
    inlines = [LineaInline, PagoInline]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
