"""
Cada presentación pasa a tener su propia regla de cantidad (mínima,
incremento, decimales), su posición dentro del producto y una versión para
detectar ediciones simultáneas.

Va en tres migraciones (0011 esquema, 0012 datos, 0013 índice y
restricciones) y no en una: en PostgreSQL, actualizar filas y después crear un
índice en la MISMA transacción falla con "pending trigger events" por las FK
diferidas. Cada migración corre en su propia transacción.
"""
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0010_imagen_por_presentacion'),
        ('tenancy', '0004_registra_dominios_iniciales'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='presentacionproducto',
            options={'ordering': ['orden', 'id']},
        ),
        migrations.AddField(
            model_name='presentacionproducto',
            name='cantidad_minima',
            field=models.DecimalField(decimal_places=2, default=Decimal('1'), max_digits=10),
        ),
        migrations.AddField(
            model_name='presentacionproducto',
            name='decimales_cantidad',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='presentacionproducto',
            name='incremento_cantidad',
            field=models.DecimalField(decimal_places=2, default=Decimal('1'), max_digits=10),
        ),
        migrations.AddField(
            model_name='presentacionproducto',
            name='orden',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='presentacionproducto',
            name='version',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
