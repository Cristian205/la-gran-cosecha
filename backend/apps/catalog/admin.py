from django.contrib import admin

from .models import Categoria, HistorialPrecio, PresentacionProducto, Producto, UnidadMedida


class PresentacionInline(admin.TabularInline):
    model = PresentacionProducto
    extra = 1


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre_categoria", "abreviatura", "orden", "estado_categoria")
    list_editable = ("orden", "estado_categoria")
    search_fields = ("nombre_categoria",)


@admin.register(UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    list_display = ("nombre_unidad", "abreviatura_unidad", "estado_unidad")
    search_fields = ("nombre_unidad",)


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ("codigo_producto", "nombre_producto", "categoria", "estado_producto")
    list_filter = ("categoria", "estado_producto")
    search_fields = ("nombre_producto", "codigo_producto")
    inlines = [PresentacionInline]


@admin.register(HistorialPrecio)
class HistorialPrecioAdmin(admin.ModelAdmin):
    list_display = ("presentacion", "precio_anterior", "precio_nuevo", "usuario", "fecha_cambio")
    list_filter = ("fecha_cambio",)
