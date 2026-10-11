"""
La tercera capa de aislamiento, para la mensajería de WhatsApp.

Misma migración que la de domicilios, y por la misma razón: `ENABLE ROW LEVEL
SECURITY` va tabla por tabla y una app nueva se queda fuera si no la escribe.

Lo que hay aquí son teléfonos de clientes y lo que se les dijo de sus pedidos:
dato personal, y de un negocio. Los webhooks de Meta y Twilio y el hilo que
envía trabajan sin `app.current_tenant` fijado —no vienen de una petición de
un negocio—, y por eso la política deja pasar cuando no está definido, igual
que en `tenancy/0003`.
"""
from django.db import migrations

TABLAS = [
    "mensajeria_configuracion",
    "mensajeria_plantilla",
    "mensajeria_mensaje",
    "mensajeria_exclusion",
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
        ("mensajeria", "0001_initial"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
