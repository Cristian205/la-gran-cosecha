import django_filters

from .models import Producto


class ProductoFilter(django_filters.FilterSet):
    categoria = django_filters.NumberFilter(field_name="categoria_id")
    estado = django_filters.ChoiceFilter(
        method="filtrar_estado",
        choices=[("activos", "Activos"), ("inactivos", "Inactivos"), ("todos", "Todos")],
    )
    # Para la página de producto (/productos/<slug>): un producto por su
    # slug, sin tener que exponer el pk numérico en la URL pública.
    slug = django_filters.CharFilter(field_name="slug")

    class Meta:
        model = Producto
        fields = ["categoria", "estado", "slug"]

    def filtrar_estado(self, queryset, name, value):
        if value == "activos":
            return queryset.filter(estado_producto=True)
        if value == "inactivos":
            return queryset.filter(estado_producto=False)
        return queryset
