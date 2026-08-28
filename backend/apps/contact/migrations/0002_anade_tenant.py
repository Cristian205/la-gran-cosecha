"""Paso 1 de 3: columna de negocio en mensajecontacto."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("contact", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="mensajecontacto",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
    ]
