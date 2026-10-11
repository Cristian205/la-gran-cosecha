from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0026_identificacion_default_en_base"),
    ]

    operations = [
        migrations.AddField(
            model_name="storesettings",
            name="legal",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
