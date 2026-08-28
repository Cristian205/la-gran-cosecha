"""
Capa 3 de las tres del aislamiento: la base de datos misma.

Las dos primeras —el manager y el ViewSet— dependen de que el código pase por
donde debe. Esta no. Cubre lo que se les escapa: un `.raw()`, un `.extra()`, un
`get_queryset()` sobrescrito que olvida filtrar, un script de exportación, una
consulta escrita a mano en un incidente de madrugada. Es la que convierte
«creemos que está aislado» en «la base de datos no entrega la fila».

Solo se aplica en PostgreSQL. En SQLite —la base de la suite por defecto— no
existe RLS y la migración no hace nada; los dos tests marcados `postgres` se
saltan solos y avisan de que esta capa no se está verificando.

ADVERTENCIA IMPORTANTE
RLS no se aplica a roles con SUPERUSER ni BYPASSRLS, y el rol `postgres` que
Supabase entrega por defecto tiene ambos. Con ese rol estas políticas existen
pero no hacen nada. Hace falta un rol dedicado para la aplicación:

    CREATE ROLE app_lagrancosecha LOGIN PASSWORD '...' NOBYPASSRLS;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO app_lagrancosecha;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_lagrancosecha;

y apuntar `DATABASE_URL` a él. El test
`test_el_rol_de_la_aplicacion_no_puede_saltarse_rls` comprueba justo esto, y es
el que hay que mirar antes de dar por buena esta capa.
"""
from django.db import migrations

# Tablas con columna de negocio. Los nombres son los reales, heredados del
# monolito original vía `Meta.db_table`.
TABLAS = [
    "ui_categoria",
    "ui_unidadmedida",
    "ui_producto",
    "ui_presentacionproducto",
    "ui_historialprecio",
    "ui_cliente",
    "ui_pedido",
    "ui_detallepedido",
    "ui_historialdetallepedido",
    "ui_detallepedidomanual",
    "ui_lotepedidos",
    "content_siteconfig",
    "content_promobanner",
    "content_testimonio",
    "content_trustbadge",
    "content_beneficiocomercial",
    "content_ofertaproducto",
    "media_archivo",
    "notifications_notificacion",
    "contact_mensajecontacto",
]

# La política compara el tenant de la fila con el que el middleware declara en
# `app.current_tenant`. Cuando la variable no está definida —una migración, un
# comando de mantenimiento, psql— la política deja pasar todo: si bloqueara,
# el propio `migrate` no podría trabajar. El aislamiento en tiempo de petición
# lo garantiza que el middleware SIEMPRE la fija; ver `activar_rls` en
# apps/tenancy/db.py.
ACTIVAR = """
ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {tabla} FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aislamiento_por_negocio ON {tabla};
CREATE POLICY aislamiento_por_negocio ON {tabla}
    USING (
        current_setting('app.current_tenant', true) IS NULL
        OR current_setting('app.current_tenant', true) = ''
        OR tenant_id = current_setting('app.current_tenant', true)::bigint
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NULL
        OR current_setting('app.current_tenant', true) = ''
        OR tenant_id = current_setting('app.current_tenant', true)::bigint
    );
"""

DESACTIVAR = """
DROP POLICY IF EXISTS aislamiento_por_negocio ON {tabla};
ALTER TABLE {tabla} NO FORCE ROW LEVEL SECURITY;
ALTER TABLE {tabla} DISABLE ROW LEVEL SECURITY;
"""


def _ejecutar(schema_editor, plantilla):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for tabla in TABLAS:
            cursor.execute(plantilla.format(tabla=tabla))


def activar(apps, schema_editor):
    _ejecutar(schema_editor, ACTIVAR)


def desactivar(apps, schema_editor):
    _ejecutar(schema_editor, DESACTIVAR)


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0002_migra_la_gran_cosecha"),
        ("catalog", "0004_tenant_obligatorio"),
        ("orders", "0005_tenant_obligatorio"),
        ("content", "0008_tenant_obligatorio"),
        ("media", "0003_tenant_obligatorio"),
        ("notifications", "0004_tenant_obligatorio"),
        ("contact", "0003_tenant_obligatorio"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
