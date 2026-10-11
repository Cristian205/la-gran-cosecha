"""Índice de orden y restricciones de la regla de cantidad (ver 0011)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0012_reparte_reglas_cantidad"),
    ]

    operations = [
        migrations.AddIndex(
            model_name='presentacionproducto',
            index=models.Index(fields=['producto', 'orden'], name='ui_present_producto_orden_idx'),
        ),
        migrations.AddConstraint(
            model_name='presentacionproducto',
            constraint=models.CheckConstraint(condition=models.Q(('cantidad_minima__gt', 0)), name='catalog_presentacion_minima_positiva'),
        ),
        migrations.AddConstraint(
            model_name='presentacionproducto',
            constraint=models.CheckConstraint(condition=models.Q(('incremento_cantidad__gt', 0)), name='catalog_presentacion_incremento_positivo'),
        ),
        migrations.AddConstraint(
            model_name='presentacionproducto',
            constraint=models.CheckConstraint(condition=models.Q(('decimales_cantidad__lte', 2)), name='catalog_presentacion_decimales_maximo'),
        ),
    ]
