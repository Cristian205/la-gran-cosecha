"""
La tercera capa de aislamiento, para las tablas del inventario.

Las tablas nuevas NO heredan la política: `ENABLE ROW LEVEL SECURITY` se activa
tabla por tabla, así que una app añadida después de `tenancy.0003` queda fuera
de la red sin que nada avise. Por eso cada app con datos de negocio trae su
propia migración de RLS, en vez de ampliar la lista de aquella: mantener una
lista central obliga a acordarse de volver a ella, y de eso justamente no se
acuerda nadie.

Aquí importa más que en otras tablas. Un saldo de existencias es la información
más sensible que guarda un negocio después de sus ventas —dice qué vende, a qué
ritmo y qué tiene parado—, y el kardex la lleva fechada.

Las condiciones son las mismas que en `tenancy/0003`, y por las mismas razones:
cuando `app.current_tenant` no está definida la política deja pasar, porque si
bloqueara ni `migrate` ni los comandos de mantenimiento podrían trabajar. Quien
garantiza el aislamiento en tiempo de petición es el middleware, que la fija
siempre.
"""
from django.db import migrations

TABLAS = [
    "inventory_ubicacion",
    "inventory_existencia",
    "inventory_movimiento",
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
        ("inventory", "0001_initial"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
