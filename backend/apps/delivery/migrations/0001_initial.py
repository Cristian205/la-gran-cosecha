"""
Las cuatro tablas del reparto: configuracion, zonas, repartidores y envios.

Generada, no escrita a mano. Lo que hay que leer para entender POR QUE tienen
esta forma esta en `delivery/models.py`, y en particular tres decisiones que el
esquema no explica solo:

    · no hay ninguna «Moto» ni ningun «Pedido a domicilio» — hay `Envio`, y
      como se llame lo dice `ConfiguracionEnvios.nombre_repartidor`
    · las zonas son una LISTA y no poligonos sobre un mapa, y eso es a
      proposito
    · `Envio.venta` y `Envio.pedido` apuntan desde AQUI hacia los otros
      modulos, nunca al reves: es lo que permite que `apps.pos` y
      `apps.orders` no sepan que este modulo existe

La RLS va en la 0002. Estas tablas no la traen puesta por nacer con tenant.
"""
import django.db.models.deletion
import django.db.models.manager
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('orders', '0007_detallepedido_nombre_congelado'),
        ('pos', '0002_row_level_security'),
        ('tenancy', '0004_registra_dominios_iniciales'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Repartidor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=120)),
                ('telefono', models.CharField(blank=True, max_length=40)),
                ('vehiculo', models.CharField(blank=True, max_length=60)),
                ('carga_maxima', models.PositiveSmallIntegerField(default=3)),
                ('activo', models.BooleanField(default=True)),
                ('orden', models.PositiveIntegerField(default=0)),
                ('tenant', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s', to='tenancy.tenant')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='repartos', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Repartidor',
                'verbose_name_plural': 'Repartidores',
                'db_table': 'delivery_repartidor',
                'ordering': ['orden', 'nombre'],
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_tenants', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='Zona',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.SlugField(max_length=40)),
                ('nombre', models.CharField(max_length=80)),
                ('tarifa', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('minutos_de_promesa', models.PositiveIntegerField(default=0)),
                ('activa', models.BooleanField(default=True)),
                ('orden', models.PositiveIntegerField(default=0)),
                ('tenant', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s', to='tenancy.tenant')),
            ],
            options={
                'verbose_name': 'Zona de reparto',
                'verbose_name_plural': 'Zonas de reparto',
                'db_table': 'delivery_zona',
                'ordering': ['orden', 'nombre'],
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_tenants', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='Envio',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_contacto', models.CharField(max_length=120)),
                ('telefono_contacto', models.CharField(blank=True, max_length=40)),
                ('direccion', models.TextField()),
                ('referencia', models.CharField(blank=True, max_length=200)),
                ('tarifa', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('cobro_contra_entrega', models.BooleanField(default=False)),
                ('monto_a_cobrar', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('estado', models.CharField(choices=[('PENDIENTE', 'Por asignar'), ('ASIGNADO', 'Asignado'), ('EN_RUTA', 'En ruta'), ('ENTREGADO', 'Entregado'), ('DEVUELTO', 'Devuelto'), ('CANCELADO', 'Cancelado')], default='PENDIENTE', max_length=20)),
                ('origen', models.CharField(choices=[('PANEL', 'Panel del negocio'), ('CAJA', 'Mostrador'), ('TIENDA', 'Tienda online')], default='PANEL', max_length=20)),
                ('nota', models.CharField(blank=True, max_length=255)),
                ('prometido_para', models.DateTimeField(blank=True, null=True)),
                ('salida', models.DateTimeField(blank=True, null=True)),
                ('entrega', models.DateTimeField(blank=True, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_actualizacion', models.DateTimeField(auto_now=True)),
                ('cliente', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios', to='orders.cliente')),
                ('creado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios_creados', to=settings.AUTH_USER_MODEL)),
                ('pedido', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios', to='orders.pedido')),
                ('tenant', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s', to='tenancy.tenant')),
                ('venta', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios', to='pos.venta')),
                ('repartidor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios', to='delivery.repartidor')),
                ('zona', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='envios', to='delivery.zona')),
            ],
            options={
                'verbose_name': 'Envío',
                'verbose_name_plural': 'Envíos',
                'db_table': 'delivery_envio',
                'ordering': ['-fecha_creacion', '-id'],
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_tenants', django.db.models.manager.Manager()),
            ],
        ),
        migrations.CreateModel(
            name='ConfiguracionEnvios',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_repartidor', models.CharField(default='Repartidor', max_length=40)),
                ('nombre_repartidor_plural', models.CharField(default='Repartidores', max_length=40)),
                ('tarifa_base', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('minutos_de_promesa', models.PositiveIntegerField(default=45)),
                ('exige_zona', models.BooleanField(default=False)),
                ('tenant', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)s', to='tenancy.tenant')),
            ],
            options={
                'verbose_name': 'Configuración de domicilios',
                'verbose_name_plural': 'Configuración de domicilios',
                'db_table': 'delivery_configuracion',
                'constraints': [models.UniqueConstraint(fields=('tenant',), name='delivery_una_config_por_negocio')],
            },
            managers=[
                ('objects', django.db.models.manager.Manager()),
                ('all_tenants', django.db.models.manager.Manager()),
            ],
        ),
        migrations.AddConstraint(
            model_name='zona',
            constraint=models.UniqueConstraint(fields=('tenant', 'codigo'), name='delivery_zona_unica'),
        ),
        migrations.AddIndex(
            model_name='envio',
            index=models.Index(fields=['tenant', 'estado'], name='delivery_tablero_idx'),
        ),
        migrations.AddIndex(
            model_name='envio',
            index=models.Index(fields=['tenant', 'repartidor', 'estado'], name='delivery_carga_idx'),
        ),
        migrations.AddIndex(
            model_name='envio',
            index=models.Index(fields=['tenant', 'fecha_creacion'], name='delivery_historico_idx'),
        ),
    ]
