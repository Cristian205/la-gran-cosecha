"""
Retira las columnas que la 0004 ya vacio.

Va aparte y despues del traslado a proposito: si el borrado viviera en la misma
migracion que crea `PrecioPlan`, un despliegue sobre datos reales se llevaria
los precios de todos los planes antes de haberlos copiado.

El borrado NO se declara con `RemoveField` a secas. Hubo una version de este
cambio en la que el borrado iba en la 0004 y el traslado no existia; una base
que aplico aquella ya no tiene las columnas, y un `RemoveField` sobre una
columna ausente falla y deja las migraciones atascadas. Con
`SeparateDatabaseAndState` el ESTADO siempre registra que los campos se fueron
—que es lo que Django necesita para que el modelo cuadre— y la BASE solo toca
lo que de verdad esta ahi.
"""
from django.db import migrations

COLUMNAS = ["activo", "moneda", "precio_mensual"]


def retirar_las_que_queden(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")

    with schema_editor.connection.cursor() as cursor:
        presentes = {
            c.name
            for c in schema_editor.connection.introspection.get_table_description(
                cursor, "billing_plan"
            )
        }

    for nombre in COLUMNAS:
        if nombre not in presentes:
            continue
        # Se usa el editor de esquema de Django y no un ALTER TABLE escrito a
        # mano: en SQLite quitar una columna es reconstruir la tabla entera, y
        # eso ya lo sabe hacer.
        schema_editor.remove_field(Plan, Plan._meta.get_field(nombre))


def noop(apps, schema_editor):
    """La marcha atras la hace `AddField` del estado; aqui no hay nada que deshacer."""


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0004_traslada_catalogo_comercial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name="plan", name="activo"),
                migrations.RemoveField(model_name="plan", name="moneda"),
                migrations.RemoveField(model_name="plan", name="precio_mensual"),
            ],
            database_operations=[
                migrations.RunPython(retirar_las_que_queden, noop),
            ],
        )
    ]
