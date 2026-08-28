"""Paso 1 de 3: columna de negocio en notificacion."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("notifications", "0002_alter_notificacion_tipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificacion",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
    ]
