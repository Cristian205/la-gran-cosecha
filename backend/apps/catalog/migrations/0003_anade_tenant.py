"""Paso 1 de 3 de la migración multiempresa: la columna, todavía opcional.

Nace `null=True` porque las 191 filas de producto que ya existen no tienen a
qué negocio pertenecer hasta que la migración de datos se lo diga. Los índices
y las restricciones de unicidad compuesta llegan en el paso 3, después del
relleno: crearlas antes obligaría a que ningún estado intermedio las violara, y
el `slug` en blanco de las filas existentes lo haría.

Los `slug` se añaden en esta misma pasada y no más adelante a propósito: son
columnas sobre las mismas tablas que reciben `tenant_id`, así que hacerlo junto
es gratis y dejarlo para la fase de SEO costaría una segunda ronda de
migraciones sobre tablas ya en producción."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("catalog", "0002_categoria_imagen"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoria",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="unidadmedida",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="producto",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="presentacionproducto",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="historialprecio",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="categoria",
            name="slug",
            field=models.SlugField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="producto",
            name="slug",
            field=models.SlugField(blank=True, max_length=220),
        ),
        migrations.AlterField(
            model_name="categoria",
            name="nombre_categoria",
            field=models.CharField(max_length=150),
        ),
        migrations.AlterField(
            model_name="unidadmedida",
            name="nombre_unidad",
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name="producto",
            name="codigo_producto",
            field=models.CharField(editable=False, max_length=50),
        ),
    ]
