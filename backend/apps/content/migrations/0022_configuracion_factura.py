import django.core.validators
from django.db import migrations, models

import apps.tenancy.almacenamiento


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0021_historia_y_mision_gran_cosecha'),
    ]

    operations = [
        migrations.AddField(
            model_name='storesettings',
            name='factura_logo',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=apps.tenancy.almacenamiento.ruta_identidad,
                help_text='Si no se sube uno, la factura usa el mismo logo del sitio.',
            ),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_aplicar_tinte_logo',
            field=models.BooleanField(
                default=True,
                help_text='Superpone un tinte verde institucional sobre el logo de la factura.',
            ),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_marca_agua_activa',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_marca_agua_texto',
            field=models.CharField(blank=True, help_text='Vacío usa el nombre de la empresa.', max_length=120),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_marca_agua_opacidad',
            field=models.PositiveSmallIntegerField(
                default=5,
                help_text='Porcentaje de opacidad de la marca de agua (1-40).',
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(40),
                ],
            ),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_nota_pie',
            field=models.CharField(
                blank=True,
                help_text='Vacío usa «¡Gracias por preferir la calidad de <tu empresa>!».',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='factura_chip_secundario',
            field=models.CharField(
                blank=True,
                help_text='Insignia corta junto al proveedor, en el encabezado de la factura. Vacío no muestra ninguna.',
                max_length=40,
            ),
        ),
    ]
