"""
El apagador de un módulo, para un solo cliente.

`permisos_extra` (la migración anterior) resolvía "este cliente necesita algo
que su plan no le da". Esto resuelve lo contrario: "este cliente no necesita
algo que su plan sí le da" — sin bajarlo de plan entero, que le quitaría
también todo lo demás que ese plan le concede.

`Subscription.permisos_disponibles()` pasa a ser: lo del plan, más
`permisos_extra`, menos `permisos_excluidos` — y la exclusión manda: no se
puede recuperar un permiso excluido colándolo también en `permisos_extra`.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0010_permisos_extra_suscripcion'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='permisos_excluidos',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
