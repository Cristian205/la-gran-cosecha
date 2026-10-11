"""
Reparte a cada presentación la regla de cantidad que tenía su producto
(`tipo_cantidad` + `permite_fraccion`), así que la tienda sigue admitiendo
exactamente las mismas cantidades que ayer: nada cambia hasta que el negocio
edite una presentación. El orden inicial es el de alta (por id), que es el
que se veía hasta hoy.
"""
from decimal import Decimal

from django.db import migrations

# (permite_fraccion, tipo_cantidad) -> (mínima = incremento, decimales).
# Misma tabla que `catalog.cantidades.regla_por_defecto`, copiada a propósito:
# una migración no puede depender de código que cambiará después.
REGLAS = {
    "cuarto": (Decimal("0.25"), 2),
    "medio": (Decimal("0.5"), 1),
}


def repartir_reglas(apps, schema_editor):
    Presentacion = apps.get_model("catalog", "PresentacionProducto")
    base = Presentacion._base_manager

    for tipo, (paso, decimales) in REGLAS.items():
        base.filter(
            producto__permite_fraccion=True, producto__tipo_cantidad=tipo
        ).update(
            cantidad_minima=paso, incremento_cantidad=paso, decimales_cantidad=decimales
        )

    # Orden 0, 1, 2… por producto, en el orden de alta.
    pendientes = []
    producto_actual, posicion = None, 0
    for pres in base.order_by("producto_id", "id").only("id", "producto_id").iterator():
        if pres.producto_id != producto_actual:
            producto_actual, posicion = pres.producto_id, 0
        pres.orden = posicion
        posicion += 1
        pendientes.append(pres)
        if len(pendientes) >= 500:
            base.bulk_update(pendientes, ["orden"])
            pendientes = []
    if pendientes:
        base.bulk_update(pendientes, ["orden"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0011_reglas_cantidad_presentacion"),
    ]

    operations = [
        migrations.RunPython(repartir_reglas, migrations.RunPython.noop),
    ]
