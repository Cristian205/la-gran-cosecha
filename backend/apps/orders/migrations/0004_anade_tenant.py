"""Paso 1 de 3: columna de negocio en pedidos, clientes y sus hijos.

`DetallePedido` y `HistorialDetallePedido` llevan la columna aunque sea
derivable de su pedido. Es deliberado: la RLS de PostgreSQL evalúa su política
sobre la fila que está leyendo, sin recorrer la jerarquía."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("orders", "0003_detallepedido_estado_revision_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="cliente",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="pedido",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="detallepedido",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="historialdetallepedido",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="detallepedidomanual",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="lotepedidos",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AlterField(
            model_name="cliente",
            name="nombre_cliente",
            field=models.CharField(max_length=200),
        ),
    ]
