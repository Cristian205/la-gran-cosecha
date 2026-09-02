"""
La app de soporte tiene migracion propia, y no es por gusto.

Sin ella Django la trata como app SIN migraciones y le crea la tabla con
`run_syncdb`, que corre ANTES de aplicar las migraciones. Como `Cosa` hereda de
`ModeloConTenant`, su clave foranea apunta a `tenancy_tenant`, que en ese
momento todavia no existe:

    ALTER TABLE "soporte_cosa" ADD CONSTRAINT ...
        REFERENCES "tenancy_tenant" ("id")
    ProgrammingError: relation "tenancy_tenant" does not exist

En SQLite no se nota: acepta referencias hacia adelante y la comprobacion se
aplaza. PostgreSQL las valida al crear la restriccion, asi que la base de
pruebas se quedaba SIN NINGUNA tabla y los trescientos tests fallaban con el
mismo error, ninguno de ellos nombrando la causa.

Es la primera vez que la suite se ejecuta contra PostgreSQL de verdad —eso lo
trajo el CI de la fase 11— y este fue el primer hallazgo. Vale como recordatorio
de que «pasa en local» y «pasa» no son lo mismo cuando el motor no es el mismo.
"""
import django.db.models.deletion
import django.db.models.manager
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('tenancy', '0004_registra_dominios_iniciales'),
    ]

    operations = [
        migrations.CreateModel(
            name='Cosa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('tenant', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s', to='tenancy.tenant')),
            ],
            options={
                'db_table': 'soporte_cosa',
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_tenants', django.db.models.manager.Manager()),
            ],
        ),
    ]
