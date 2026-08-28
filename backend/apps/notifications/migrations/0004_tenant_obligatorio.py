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
        ("notifications", "0003_anade_tenant"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificacion",
            name="tenant",
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
    ]
