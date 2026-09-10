"""
Un módulo puntual para un cliente, sin inventarle un plan.

`limites_extra` ya resolvía esto para números («este cliente pactó 35
usuarios en vez de los 20 de su plan»); `permisos_extra` es lo mismo para
módulos. Sin esto, darle Domicilios a una sola empresa que no está lista para
subir de plan entero obligaba a crear un plan a su medida que nadie más iba a
contratar — el mismo problema que `Subscription.limites_extra` ya evitaba.

`Subscription.permisos_disponibles()` pasa a conceder la unión de
`plan.permisos` y `permisos_extra`, siempre acotada a lo que la plataforma
tenga activo.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0009_producto_domicilios'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='permisos_extra',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
