import django_filters
from django.db.models import Exists, OuterRef

from .models import PresentacionProducto, Producto


class ProductoFilter(django_filters.FilterSet):
    categoria = django_filters.NumberFilter(field_name="categoria_id")
    estado = django_filters.ChoiceFilter(
        method="filtrar_estado",
        choices=[("activos", "Activos"), ("inactivos", "Inactivos"), ("todos", "Todos")],
    )
    # Para la página de producto (/productos/<slug>): un producto por su
    # slug, sin tener que exponer el pk numérico en la URL pública.
    slug = django_filters.CharFilter(field_name="slug")
    # "Se vende por": los productos que tienen al menos una presentación
    # ACTIVA en esa unidad de venta. Es el filtro que un negocio usa de verdad
    # ("lo que venga por bulto", "lo que venga por caja"); el precio no se
    # filtra porque `precio_desde` mezcla unidades —una libra y una caja del
    # mismo producto— y un rango sobre eso no significaría nada.
    unidad = django_filters.NumberFilter(method="filtrar_unidad")

    class Meta:
        model = Producto
        fields = ["categoria", "estado", "slug", "unidad"]

    def filtrar_estado(self, queryset, name, value):
        if value == "activos":
            return queryset.filter(estado_producto=True)
        if value == "inactivos":
            return queryset.filter(estado_producto=False)
        return queryset

    def filtrar_unidad(self, queryset, name, value):
        # `Exists` y no `filter(presentaciones__unidad_venta=…)`: la consulta
        # del catálogo ya se une a las presentaciones para anotar el precio, y
        # una segunda unión a-muchos repetiría el producto una vez por cada
        # presentación que coincida.
        return queryset.filter(
            Exists(
                PresentacionProducto.objects.filter(
                    producto=OuterRef("pk"),
                    unidad_venta_id=value,
                    estado_presentacion=True,
                )
            )
        )
