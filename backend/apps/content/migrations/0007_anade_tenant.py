"""Paso 1 de 3: fin del singleton de configuración.

`SiteConfig` se RENOMBRA a `StoreSettings`; no se recrea. El autodetector de
Django proponía un CreateModel + DeleteModel sobre la misma `db_table`, que
habría dejado caer la tabla con la configuración real del sitio dentro. Como el
nombre de tabla no cambia, `RenameModel` no toca la base: solo el estado."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("content", "0006_beneficiocomercial_siteconfig_cotizacion_texto_and_more"),
    ]

    operations = [
        migrations.RenameModel(old_name="SiteConfig", new_name="StoreSettings"),
        migrations.AlterModelOptions(
            name="storesettings",
            options={
                "verbose_name": "Configuración de la tienda",
                "verbose_name_plural": "Configuración de la tienda",
            },
        ),
        migrations.AddField(
            model_name="storesettings",
            name="tenant",
            field=models.OneToOneField(
                editable=False, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="settings", to="tenancy.tenant",
            ),
        ),
        migrations.AddField(
            model_name="promobanner",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="testimonio",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="trustbadge",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="beneficiocomercial",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
        migrations.AddField(
            model_name="ofertaproducto",
            name="tenant",
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)s", to="tenancy.tenant"),
        ),
    ]
