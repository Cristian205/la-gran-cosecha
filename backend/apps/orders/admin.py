from django.contrib import admin

from .models import (
    Cliente,
    DetallePedido,
    DetallePedidoManual,
    HistorialDetallePedido,
    LotePedidos,
    Pedido,
)


class DetalleInline(admin.TabularInline):
    model = DetallePedido
    extra = 0
    readonly_fields = ("subtotal",)


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre_cliente", "telefono_cliente", "fecha_registro_cliente")
    search_fields = ("nombre_cliente", "telefono_cliente")


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "estado", "total_pedido", "fecha_pedido")
    list_filter = ("estado", "fecha_pedido")
    search_fields = ("id", "cliente__nombre_cliente")
    inlines = [DetalleInline]


@admin.register(LotePedidos)
class LotePedidosAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "usuario", "cantidad_pedidos", "total_lote", "fecha_creacion")
    list_filter = ("tipo",)


admin.site.register(DetallePedidoManual)
admin.site.register(HistorialDetallePedido)
