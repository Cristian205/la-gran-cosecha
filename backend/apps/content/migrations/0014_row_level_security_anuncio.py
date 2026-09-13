"""
La tercera capa de aislamiento, para `content_anuncio`.

Mismo motivo que `storefront/migrations/0010_row_level_security`: una tabla
nueva no hereda la política de `tenancy.0003` — `ENABLE ROW LEVEL SECURITY` se
activa tabla por tabla, así que una tabla creada después queda fuera de la red
sin que nada avise, salvo `test_toda_tabla_con_negocio_esta_bajo_rls`, que es
quien de verdad obliga a esta migración a existir.

Las demás tablas de `content` (`content_promobanner`, `content_testimonio`,
etc.) ya están cubiertas por `tenancy.0003` porque nacieron antes de que se
escribiera: `content_anuncio` es la primera tabla de esta app en llegar
después, y por eso trae su propia migración en vez de ampliar aquella lista.
"""
from django.db import migrations

TABLAS = [
    "content_anuncio",
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
        ("content", "0013_anuncio"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
