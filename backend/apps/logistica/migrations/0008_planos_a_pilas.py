"""
Convierte los despachos guardados con el formato de REJILLA (filas × columnas)
al formato de PILAS, sin cambiar dónde quedó cada canastilla.

Antes: medidas = {filas, columnas, girada, niveles, ...}, posiciones con
(fila, columna, nivel). Ahora: medidas.pilas = [{x, y, rot, zona, acceso,
etiqueta}], posiciones con (pila, nivel) y pila = fila × columnas + columna,
que es exactamente el orden en que `esquemas.esquema_rejilla` genera las pilas.
"""
from django.db import migrations


def _a_pilas(medidas: dict) -> dict:
    c = medidas["canastilla"]
    girada = bool(medidas.get("girada"))
    paso_x, paso_y = (c["ancho"], c["largo"]) if girada else (c["largo"], c["ancho"])
    filas, columnas = medidas.get("filas", 0), medidas.get("columnas", 0)
    pilas = [
        {
            "x": round((f + 0.5) * paso_x, 1),
            "y": round((col + 0.5) * paso_y, 1),
            "rot": 90 if girada else 0,
            "zona": "rejilla",
            "acceso": "puerta",
            "etiqueta": f"F{f + 1}-C{col + 1}",
        }
        for f in range(filas)
        for col in range(columnas)
    ]
    return {**medidas, "esquema": "rejilla", "pilas": pilas, "avisos": [], "errores": []}


def convertir(apps, schema_editor):
    PlanoCarga = apps.get_model("logistica", "PlanoCarga")
    for plano in PlanoCarga.objects.all():
        medidas = plano.medidas or {}
        if "pilas" in medidas or "filas" not in medidas:
            continue
        nuevas = _a_pilas(medidas)
        columnas = medidas["columnas"]
        alto = medidas["canastilla"]["alto"]
        posiciones = []
        for p in plano.posiciones or []:
            if "pila" in p:
                posiciones.append(p)
                continue
            pila = p["fila"] * columnas + p["columna"]
            hueco = nuevas["pilas"][pila]
            posiciones.append({
                "grupo": p["grupo"], "pila": pila, "nivel": p["nivel"],
                "x_cm": hueco["x"], "y_cm": hueco["y"], "z_cm": round((p["nivel"] + 0.5) * alto, 1),
                "rotacion": hueco["rot"],
            })
        plano.medidas = nuevas
        plano.posiciones = posiciones
        plano.save(update_fields=["medidas", "posiciones"])


class Migration(migrations.Migration):
    dependencies = [("logistica", "0007_bloqueos")]

    # Al revertir no se toca nada: el formato de pilas también describe la rejilla.
    operations = [migrations.RunPython(convertir, migrations.RunPython.noop)]
