"""
Dos cosas que la migración de esquema anterior no puede hacer sola.

1. RLS para `ui_eventopedido`. `ENABLE ROW LEVEL SECURITY` va tabla por tabla
   (ver `tenancy/0003`) y una tabla nueva se queda fuera si nadie lo escribe:
   la auditoría de un pedido es de un negocio, igual que el pedido.

2. Reconstruir `cantidad_original` / `precio_original` de las líneas que ya
   existían. No se copia lo de hoy a ciegas: si la línea se editó, el primer
   `valor_anterior` de su historial ES lo que pidió el cliente. Solo sin
   historial se toma el valor actual, que entonces nunca cambió.
"""
from decimal import Decimal, InvalidOperation

from django.db import migrations

TABLAS = ["ui_eventopedido"]

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


def _rls(schema_editor, plantilla):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for tabla in TABLAS:
            cursor.execute(plantilla.format(tabla=tabla))


def activar_rls(apps, schema_editor):
    _rls(schema_editor, ACTIVAR)


def desactivar_rls(apps, schema_editor):
    _rls(schema_editor, DESACTIVAR)


def _decimal(texto):
    try:
        return Decimal(str(texto).strip())
    except (InvalidOperation, TypeError, ValueError):
        return None


def reconstruir_originales(apps, schema_editor):
    DetallePedido = apps.get_model("orders", "DetallePedido")
    Historial = apps.get_model("orders", "HistorialDetallePedido")

    # El primer valor anterior de cada (línea, campo): lo que había antes de
    # que nadie la tocara.
    primeros = {}
    for h in Historial.objects.filter(campo__in=("cantidad", "precio_unitario")).order_by("fecha", "id"):
        primeros.setdefault((h.detalle_id, h.campo), h.valor_anterior)

    lote = []
    for d in DetallePedido.objects.filter(cantidad_original__isnull=True).iterator(chunk_size=500):
        d.cantidad_original = _decimal(primeros.get((d.id, "cantidad"))) or d.cantidad
        precio = _decimal(primeros.get((d.id, "precio_unitario")))
        d.precio_original = precio if precio is not None else d.precio_unitario
        lote.append(d)
        if len(lote) >= 500:
            DetallePedido.objects.bulk_update(lote, ["cantidad_original", "precio_original"])
            lote = []
    if lote:
        DetallePedido.objects.bulk_update(lote, ["cantidad_original", "precio_original"])


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0013_trazabilidad_y_entrega"),
        ("tenancy", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunPython(activar_rls, desactivar_rls),
        migrations.RunPython(reconstruir_originales, migrations.RunPython.noop),
    ]
