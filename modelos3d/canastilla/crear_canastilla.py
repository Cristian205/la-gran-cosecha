"""
Canastilla plástica para el plano de carga (se ejecuta DENTRO de Blender).

Modelo propio, sin fuentes externas. Es UNITARIO (1 × 1 × 1 m, centrado en
el origen): la web lo escala a las medidas REALES de la canastilla registrada
en el sistema (largo × ancho × alto), así que no lleva ninguna medida inventada.
El espesor de pared y las ranuras son proporciones visuales, no especificación.

Geometría: fondo, cuatro paredes, borde superior reforzado, ranuras de
ventilación en las paredes largas y asas en las cortas. Abierta por arriba.
Un solo material blanco: la web lo tiñe por destino (color por instancia).

Ejes de Blender: X = largo, Y = ancho, Z = alto.
"""
import bpy
import bmesh

NOMBRE = "Canastilla"
PARED = 0.035      # proporción del lado
FONDO = 0.04
BORDE = 0.06       # alto del refuerzo superior
for o in [o for o in bpy.data.objects if o.name.startswith(NOMBRE)]:
    bpy.data.objects.remove(o, do_unlink=True)


def caja(bm, cx, cy, cz, sx, sy, sz):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r["verts"]:
        v.co.x = cx + v.co.x * sx
        v.co.y = cy + v.co.y * sy
        v.co.z = cz + v.co.z * sz


bm = bmesh.new()
# Fondo
caja(bm, 0, 0, -0.5 + FONDO / 2, 1, 1, FONDO)
# Paredes (de fondo a borde), cada una en tramos para dejar las ranuras/asa.
alto_pared = 1 - FONDO
z0 = -0.5 + FONDO

def pared_x(signo):
    """Pared larga (normal ±Y) con tres filas de ranuras: se arma con barras."""
    y = signo * (0.5 - PARED / 2)
    # barras horizontales macizas (entre ranuras)
    caja(bm, 0, y, z0 + 0.08, 1, PARED, 0.16)
    caja(bm, 0, y, z0 + 0.32, 1, PARED, 0.12)
    caja(bm, 0, y, z0 + 0.54, 1, PARED, 0.12)
    caja(bm, 0, y, (z0 + 0.70 + 0.5) / 2, 1, PARED, 0.5 - (z0 + 0.70))
    # montantes verticales que cierran las ranuras (6 por pared)
    for i in range(7):
        x = -0.5 + PARED / 2 + i * (1 - PARED) / 6
        caja(bm, x, y, z0 + 0.39, PARED * 1.6, PARED, 0.62)

def pared_y(signo):
    """Pared corta (normal ±X) con asa: maciza salvo un hueco arriba al centro."""
    x = signo * (0.5 - PARED / 2)
    caja(bm, x, 0, z0 + 0.35, PARED, 1, 0.70)               # parte baja
    caja(bm, x, -0.34, z0 + 0.84, PARED, 0.32, 0.28)        # a los lados del asa
    caja(bm, x, 0.34, z0 + 0.84, PARED, 0.32, 0.28)
    caja(bm, x, 0, 0.5 - 0.05, PARED, 0.36, 0.10)           # sobre el asa (agarradera)

for s in (-1, 1):
    pared_x(s)
    pared_y(s)
# Borde superior reforzado (anillo un poco más grueso)
for s in (-1, 1):
    caja(bm, 0, s * (0.5 - PARED * 0.7), 0.5 - BORDE / 2, 1, PARED * 1.4, BORDE)
    caja(bm, s * (0.5 - PARED * 0.7), 0, 0.5 - BORDE / 2, PARED * 1.4, 1, BORDE)

bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
me = bpy.data.meshes.new(NOMBRE)
bm.to_mesh(me)
bm.free()
obj = bpy.data.objects.new(NOMBRE, me)
bpy.context.scene.collection.objects.link(obj)
obj.location = (0, 0, 0)

mat = bpy.data.materials.get("Canastilla_Plastico") or bpy.data.materials.new("Canastilla_Plastico")
mat.use_nodes = True
b = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
b.inputs["Base Color"].default_value = (1, 1, 1, 1)
b.inputs["Roughness"].default_value = 0.55
b.inputs["Metallic"].default_value = 0.0
me.materials.clear()
me.materials.append(mat)
print(NOMBRE, len(me.polygons), "caras")
