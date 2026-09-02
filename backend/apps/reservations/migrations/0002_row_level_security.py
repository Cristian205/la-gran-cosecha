"""
La tercera capa de aislamiento, para las tablas de la agenda.

Tercera vez que se escribe esta migracion —inventario, caja, y ahora reservas—
y sigue sin sacarse a una utilidad compartida, por la misma razon que la lista
no es central: `ENABLE ROW LEVEL SECURITY` se activa tabla por tabla, y una app
posterior a `tenancy.0003` se queda fuera de la red sin que nada avise. Un
ayudante compartido facilitaria escribirla, pero lo que hace falta es acordarse
de escribirla, y de eso se encarga el test que recorre las tablas de todas las
apps con tenant.

Lo que hay aqui es la agenda de un negocio: a quien espera, a que hora y con
que telefono. Es dato personal de gente que ni siquiera tiene cuenta en la
plataforma.

Las condiciones son las mismas que en `tenancy/0003`: cuando
`app.current_tenant` no esta definida la politica deja pasar, porque si
bloqueara ni `migrate` ni los comandos de mantenimiento podrian trabajar. Quien
garantiza el aislamiento en tiempo de peticion es el middleware, que la fija
siempre.
"""
from django.db import migrations

TABLAS = [
    "reservations_configuracion",
    "reservations_recurso",
    "reservations_reserva",
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
        ("reservations", "0001_initial"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
