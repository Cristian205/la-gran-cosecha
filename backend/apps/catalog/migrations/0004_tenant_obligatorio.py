"""Paso 3 de 3: el negocio pasa a ser obligatorio.

Va después del relleno a propósito: aplicar `null=False` con filas sin asignar
haría fallar la migración, y crear la unicidad compuesta antes de generar los
slug la habría violado con 191 productos de slug vacío.

A partir de aquí no puede existir una fila de negocio sin dueño.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0002_migra_la_gran_cosecha"),
        ("catalog", "0003_anade_tenant"),
    ]

    operations = [
        # Los índices de una sola columna quedan superados por los compuestos
        # de más abajo: toda consulta va acotada por negocio, así que el índice
        # útil es el que lleva `tenant` como primera columna. Mantener ambos
        # solo encarecería cada escritura.
        migrations.RemoveIndex(model_name="categoria", name="ui_categori_nombre__7990dc_idx"),
        migrations.RemoveIndex(model_name="categoria", name="ui_categori_orden_0284c3_idx"),
        migrations.RemoveIndex(model_name="producto", name="ui_producto_nombre__9e7155_idx"),
        migrations.RemoveIndex(model_name="producto", name="ui_producto_codigo__2a0c49_idx"),
        migrations.RemoveIndex(model_name="producto", name="ui_producto_orden_0c05b9_idx"),
        migrations.AlterField(
            model_name="categoria",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AlterField(
            model_name="unidadmedida",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AlterField(
            model_name="producto",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AlterField(
            model_name="presentacionproducto",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AlterField(
            model_name="historialprecio",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddIndex(
            model_name="categoria",
            index=models.Index(fields=["tenant", "nombre_categoria"], name="ui_categori_tenant_nombre_idx"),
        ),
        migrations.AddIndex(
            model_name="categoria",
            index=models.Index(fields=["tenant", "orden"], name="ui_categori_tenant_orden_idx"),
        ),
        migrations.AddIndex(
            model_name="producto",
            index=models.Index(fields=["tenant", "nombre_producto"], name="ui_producto_tenant_nombre_idx"),
        ),
        migrations.AddIndex(
            model_name="producto",
            index=models.Index(fields=["tenant", "codigo_producto"], name="ui_producto_tenant_codigo_idx"),
        ),
        migrations.AddIndex(
            model_name="producto",
            index=models.Index(fields=["tenant", "orden"], name="ui_producto_tenant_orden_idx"),
        ),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(
                fields=["tenant", "nombre_categoria"], name="catalog_categoria_unica_por_negocio"
            ),
        ),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(
                fields=["tenant", "slug"], name="catalog_categoria_slug_unico_por_negocio"
            ),
        ),
        migrations.AddConstraint(
            model_name="unidadmedida",
            constraint=models.UniqueConstraint(
                fields=["tenant", "nombre_unidad"], name="catalog_unidad_unica_por_negocio"
            ),
        ),
        migrations.AddConstraint(
            model_name="producto",
            constraint=models.UniqueConstraint(
                fields=["tenant", "codigo_producto"], name="catalog_producto_codigo_unico_por_negocio"
            ),
        ),
        migrations.AddConstraint(
            model_name="producto",
            constraint=models.UniqueConstraint(
                fields=["tenant", "slug"], name="catalog_producto_slug_unico_por_negocio"
            ),
        ),
    ]
