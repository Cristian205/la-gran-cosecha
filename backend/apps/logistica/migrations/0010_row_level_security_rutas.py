"""
RLS de las tablas de rutas, ajustes y reglas de carga (misma política que `0002`).

Va en su propia migración `*row_level_security*` con su lista `TABLAS`: así la
encuentra el test que verifica que toda tabla con negocio está bajo RLS.
"""
from django.db import migrations

TABLAS = [
    "logistica_programacion_semanal",
    "logistica_ruta",
    "logistica_parada_ruta",
    "logistica_ajuste_ruta",
    "logistica_regla_carga",
]

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
    # En SQLite —la base de la suite por defecto— no existe RLS y esto no hace
    # nada. Los tests marcados `postgres` son los que verifican esta capa.
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
        ("logistica", "0009_rutas_y_planificacion"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
