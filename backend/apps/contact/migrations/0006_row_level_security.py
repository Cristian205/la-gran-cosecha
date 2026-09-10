"""
La tercera capa de aislamiento, para la lista de correo.

Quinta vez que se escribe esta migracion, y la razon de que no exista una
utilidad compartida no ha cambiado: `ENABLE ROW LEVEL SECURITY` se activa tabla
por tabla, asi que una tabla creada DESPUES de `tenancy.0003` se queda fuera de
la red sin que nada avise. Lo que hace falta no es que sea comodo escribirla,
sino acordarse de escribirla, y de eso se encarga el test que recorre las
tablas de todas las apps con tenant.

`contact_mensajecontacto` ya estaba en `tenancy.0003`; `contact_suscriptor`
nace hoy y por eso necesita la suya.

Y lo que hay aqui es lo mas sensible que guarda el motor de tiendas: una lista
de correos electronicos de gente que ni siquiera tiene cuenta en la plataforma.
Una fuga aqui no es un dato de negocio mal enseñado, es la lista de clientes de
un negocio en manos de otro.

Las condiciones son las mismas que en `tenancy/0003`: con `app.current_tenant`
sin definir la politica deja pasar, porque si bloqueara ni `migrate` ni los
comandos de mantenimiento podrian trabajar. Quien garantiza el aislamiento en
tiempo de peticion es el middleware, que la fija siempre.
"""
from django.db import migrations

TABLAS = ["contact_suscriptor"]

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
        ("contact", "0005_suscriptor"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
