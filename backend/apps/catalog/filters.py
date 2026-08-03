import django_filters

from .models import Producto


class ProductoFilter(django_filters.FilterSet):
    categoria = django_filters.NumberFilter(field_name="categoria_id")
    estado = django_filters.ChoiceFilter(
        method="filtrar_estado",
        choices=[("activos", "Activos"), ("inactivos", "Inactivos"), ("todos", "Todos")],
    )

    class Meta:
        model = Producto
        fields = ["categoria", "estado"]

    def filtrar_estado(self, queryset, name, value):
        if value == "activos":
            return queryset.filter(estado_producto=True)
        if value == "inactivos":
            return queryset.filter(estado_producto=False)
        return queryset
