from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Categoria, Cliente, Pedido, PresentacionProducto, 
    Producto, DetallePedido, UnidadMedida, Usuario
)

# --- INLINES (Vistas integradas) ---

class DetallePedidoInline(admin.TabularInline):
    """Permite cargar productos directamente desde la ficha del pedido"""
    model = DetallePedido
    extra = 1
    autocomplete_fields = ['presentacion'] 
    
    # REVISIÓN DE CAMPOS: 
    # Asegúrate de que estos nombres existan en tu class DetallePedido de models.py
    fields = ('presentacion', 'cantidad', 'precio_unitario', 'subtotal')
    readonly_fields = ('subtotal',)

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        field = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == 'cantidad':
            field.widget.attrs['style'] = 'width: 90px;'
        return field

class PresentacionInline(admin.TabularInline):
    """Permite definir precios y empaques desde la ficha del producto"""
    model = PresentacionProducto
    extra = 1
    fields = ('nombre_presentacion', 'unidad_venta', 'factor_conversion', 'precio_unitario', 'estado_presentacion')

# --- CONFIGURACIONES PRINCIPALES ---

@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    # Columnas con diseño profesional
    list_display = ('id', 'display_cliente', 'fecha_pedido', 'estado_badge', 'total_formateado', 'usuario')
    list_filter = ('estado', 'fecha_pedido', 'usuario')
    search_fields = ('id', 'cliente__nombre_cliente', 'cliente__telefono_cliente')
    ordering = ('-fecha_pedido',)
    inlines = [DetallePedidoInline]

    # Formateo de moneda para la lista (COP)
    # Versión CORREGIDA
    def total_formateado(self, obj):
        # Formateamos el número primero
        valor_pesos = "{:,.0f}".format(obj.total_pedido).replace(',', '.')
        # Pasamos el valor como un argumento extra a format_html
        return format_html('<b style="color: #059669;">$ {}</b>', valor_pesos)
    
    total_formateado.short_description = 'Total Pedido'

    # Badge de colores para el estado
    def estado_badge(self, obj):
        colors = {
            'PENDIENTE': '#d97706',  # Ámbar
            'ENTREGADO': '#059669',  # Esmeralda
            'CANCELADO': '#dc2626',  # Rojo
            'IMPRESO': '#2563eb',    # Azul
        }
        color = colors.get(obj.estado, '#6b7280')
        return format_html(
            '<span style="color: white; background-color: {}; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 10px;">{}</span>',
            color, obj.get_estado_display()
        )
    estado_badge.short_description = 'Estado'

    def display_cliente(self, obj):
        if obj.cliente:
            return format_html("<b>{}</b><br><small>{}</small>", 
                               obj.cliente.nombre_cliente, 
                               obj.cliente.telefono_cliente)
        return "⚠️ SIN CLIENTE"
    display_cliente.short_description = 'Cliente'

@admin.register(PresentacionProducto)
class PresentacionProductoAdmin(admin.ModelAdmin):
    # ESTO CORRIGE EL ERROR admin.E040 (Imprescindible para el autocompletado)
    search_fields = ['producto__nombre_producto', 'nombre_presentacion']
    list_display = ('producto', 'nombre_presentacion', 'unidad_venta', 'precio_unitario', 'estado_presentacion')
    list_filter = ('estado_presentacion', 'unidad_venta')
    list_editable = ('precio_unitario', 'estado_presentacion')

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('codigo_producto','nombre_producto', 'categoria', 'unidad_base', 'estado_producto')
    list_filter = ('categoria', 'estado_producto')
    search_fields = ('nombre_producto', 'codigo_producto')
    inlines = [PresentacionInline]

# --- REGISTROS COMPLEMENTARIOS ---

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre_cliente', 'telefono_cliente', 'fecha_registro_cliente')
    search_fields = ('nombre_cliente', 'telefono_cliente')

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre_categoria', 'orden', 'estado_categoria')
    list_editable = ('orden', 'estado_categoria')

@admin.register(UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    list_display = ('nombre_unidad', 'abreviatura_unidad')
    search_fields = ('nombre_unidad',)

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ('nombre_usuario', 'email_usuario', 'is_staff', 'is_active')
    search_fields = ('nombre_usuario', 'email_usuario')