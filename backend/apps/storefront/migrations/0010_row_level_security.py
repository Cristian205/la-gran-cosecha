"""
La tercera capa de aislamiento, para las tablas de storefront.

Las tablas nuevas NO heredan la política: `ENABLE ROW LEVEL SECURITY` se activa
tabla por tabla, así que una app añadida después de `tenancy.0003` queda fuera
de la red sin que nada avise. Por eso cada app con datos de negocio trae su
propia migración de RLS, en vez de ampliar la lista de aquella: mantener una
lista central obliga a acordarse de volver a ella, y de eso justamente no se
acuerda nadie.

Estas son las páginas de cada tienda: su composición, su SEO y su historial de
versiones. Se quedaron fuera porque la app nació DESPUÉS de `tenancy.0003`, y
activar RLS es tabla por tabla — una app posterior no hereda nada y nada avisa.

Es justo el fallo que este archivo cierra, y por eso viene acompañado de
`test_toda_tabla_con_negocio_esta_bajo_rls`: enumera los modelos con columna de
negocio y exige que cada uno esté cubierto o exento con su razón escrita. Sin
ese test, la quinta app volvería a quedarse fuera.

Lo que NO entra: `Bloque`, `Tema`, `TokenTema` y `Plantilla`. No pertenecen a
ningún negocio — son el catálogo de la plataforma, como `Plan`.

Las condiciones son las mismas que en `tenancy/0003`, y por las mismas razones:
cuando `app.current_tenant` no está definida la política deja pasar, porque si
bloqueara ni `migrate` ni los comandos de mantenimiento podrían trabajar. Quien
garantiza el aislamiento en tiempo de petición es el middleware, que la fija
siempre.
"""
from django.db import migrations

TABLAS = [
    "storefront_pagina",
    "storefront_versionpagina",
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
        ("storefront", "0009_armazon_y_paginas_cosecha"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [migrations.RunPython(activar, desactivar)]
