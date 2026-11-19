"""
Detalle de la cabina del Hino 500 (se ejecuta DENTRO de Blender, después de
`preparar_hino500.py`).

1. Vidrios claros y translúcidos: el interior se ve desde fuera.
2. Espejos: carcasa gris clara y luna espejada (antes eran negros).
3. Interior modelado (configuración de Colombia: conductor a la IZQUIERDA,
   que en este modelo es +X porque el frente mira a −Y): tablero con
   instrumentos, timón y columna, consola con radio, palanca, silla del
   conductor, banca de dos puestos, viseras, piso y forro de techo/espalda.

Todo el interior es un objeto aparte, «CabinaInterior», para poder ocultarlo
o simplificarlo en equipos lentos sin tocar la carrocería.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

O = bpy.data.objects
cab = O["Cabina"]


def mat(nombre, color, metal=0.0, rugos=0.5, alpha=1.0, emision=0.0):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugos
    b.inputs["Alpha"].default_value = alpha
    b.inputs["Emission Strength"].default_value = emision
    if emision:
        b.inputs["Emission Color"].default_value = (*color, 1)
    m.surface_render_method = "BLENDED" if alpha < 1 else "DITHERED"
    m.diffuse_color = (*color, alpha)
    return m


# ---------- 1. Vidrios translúcidos ----------
mat("Hino_Vidrio", (0.55, 0.66, 0.72), 0.0, 0.03, 0.32)

# ---------- 2. Espejos claros ----------
carcasa = mat("Hino_EspejoCarcasa", (0.78, 0.8, 0.82), 0.6, 0.3)
luna = mat("Hino_EspejoLuna", (0.92, 0.94, 0.96), 1.0, 0.04)
me = cab.data
if carcasa.name not in me.materials:
    me.materials.append(carcasa)
if luna.name not in me.materials:
    me.materials.append(luna)
i_carcasa = list(me.materials).index(carcasa)
i_luna = list(me.materials).index(luna)
i_oscuro = list(me.materials).index(bpy.data.materials["Hino_PlasticoOscuro"])
# Se trabaja por PIEZA suelta (cada espejo y su brazo son piezas aparte en el
# modelo): toda la pieza recibe la carcasa clara y solo la cara que mira hacia
# atrás, la luna. Hacerlo cara por cara dejaba espejos a parches.
for p in me.polygons:  # idempotente: si se corre dos veces, parte de cero
    if p.material_index in (i_carcasa, i_luna):
        p.material_index = i_oscuro
bm_c = bmesh.new()
bm_c.from_mesh(me)
bm_c.faces.ensure_lookup_table()
visto, cambiadas = set(), 0
for f in bm_c.faces:
    if f.index in visto:
        continue
    pieza, pila = [], [f]
    visto.add(f.index)
    while pila:
        g = pila.pop()
        pieza.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in visto:
                    visto.add(h.index)
                    pila.append(h)
    vs = [v.co for g in pieza for v in g.verts]
    # Pieza pequeña (< 45 cm), toda por fuera de |x| 0,88, delante y en lo alto.
    tam = max(max(v[i] for v in vs) - min(v[i] for v in vs) for i in range(3))
    fuera = (tam < 0.45 and all(abs(v.x) > 0.88 for v in vs)
             and max(v.y for v in vs) < -0.5 and min(v.z for v in vs) > 1.25)
    if fuera:
        for g in pieza:
            g.material_index = i_luna if g.normal.y > 0.5 else i_carcasa
            cambiadas += 1
bm_c.to_mesh(me)
bm_c.free()
me.update()

# ---------- 3. Interior ----------
M = {
    "tablero": mat("Interior_Tablero", (0.16, 0.17, 0.18), 0.0, 0.7),
    "tablero_sup": mat("Interior_TableroSup", (0.24, 0.25, 0.27), 0.0, 0.8),
    "tela": mat("Interior_Tela", (0.2, 0.24, 0.3), 0.0, 0.9),
    "costura": mat("Interior_Costura", (0.12, 0.13, 0.15), 0.0, 0.9),
    "forro": mat("Interior_Forro", (0.72, 0.72, 0.7), 0.0, 0.85),
    "piso": mat("Interior_Piso", (0.1, 0.1, 0.11), 0.0, 0.95),
    "timon": mat("Interior_Timon", (0.07, 0.07, 0.08), 0.1, 0.5),
    "cromo": bpy.data.materials["Hino_Cromo"],
    "pantalla": mat("Interior_Pantalla", (0.2, 0.55, 0.85), 0.0, 0.2, 1.0, 0.8),
    "instrumentos": mat("Interior_Instrumentos", (0.9, 0.9, 0.85), 0.0, 0.3, 1.0, 0.25),
    "visera": mat("Interior_Visera", (0.62, 0.62, 0.6), 0.0, 0.8),
}
mats = list(M)
bm = bmesh.new()


def caja(c, s, m, rot=None):
    r = bmesh.ops.create_cube(bm, size=1.0)
    R = rot or Matrix.Identity(3)
    for v in r["verts"]:
        v.co = Vector(c) + R @ Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mats.index(m)


def cilindro(c, radio, alto, m, rot, segs=16):
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radio, radius2=radio, depth=alto)
    for v in r["verts"]:
        v.co = Vector(c) + rot @ v.co
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mats.index(m)


def aro(c, radio, grosor, m, rot, segs=24):
    """Aro del timón como anillo de pequeños cilindros (sin depender de add-ons)."""
    for i in range(segs):
        a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
        p0 = Vector((math.cos(a0) * radio, math.sin(a0) * radio, 0))
        p1 = Vector((math.cos(a1) * radio, math.sin(a1) * radio, 0))
        medio, d = (p0 + p1) / 2, (p1 - p0)
        rz = Matrix.Rotation(math.atan2(d.y, d.x), 3, "Z") @ Matrix.Rotation(math.pi / 2, 3, "Y")
        cilindro(Vector(c) + rot @ medio, grosor, d.length * 1.05, m, rot @ rz, 8)


X_COND = 0.52        # conductor (izquierda en Colombia)
X_ACOMP = -0.42      # banca de dos puestos
Z_PISO = 1.22

# Piso, forro de techo y espalda (tapa la vista hacia el furgón)
caja((0, -0.2, Z_PISO), (2.0, 1.55, 0.04), "piso")
caja((0, -0.25, 2.33), (2.0, 1.55, 0.03), "forro")
caja((0, 0.57, 1.78), (2.0, 0.03, 1.12), "forro")
# Tablero: cuerpo, tapa superior inclinada y guantera
caja((0, -0.92, 1.43), (1.98, 0.32, 0.42), "tablero")
inclin = Matrix.Rotation(math.radians(-14), 3, "X")
caja((0, -0.93, 1.66), (1.98, 0.36, 0.05), "tablero_sup", inclin)
caja((X_ACOMP, -0.76, 1.47), (0.5, 0.02, 0.16), "costura")
# Binnacle de instrumentos frente al conductor, con dos relojes
caja((X_COND, -0.84, 1.66), (0.46, 0.14, 0.13), "tablero")
for dx in (-0.1, 0.1):
    cilindro((X_COND + dx, -0.77, 1.66), 0.05, 0.01, "instrumentos", Matrix.Rotation(math.pi / 2, 3, "X"))
# Consola central con radio/pantalla y palanca de cambios
caja((0.06, -0.78, 1.42), (0.34, 0.14, 0.34), "tablero")
caja((0.06, -0.705, 1.5), (0.22, 0.01, 0.1), "pantalla")
cilindro((0.1, -0.45, 1.36), 0.012, 0.32, "cromo", Matrix.Identity(3))
caja((0.1, -0.45, 1.53), (0.05, 0.05, 0.06), "timon")
caja((0.1, -0.45, 1.22), (0.16, 0.16, 0.04), "timon")      # fuelle
# Timón: columna, aro y radios (inclinado hacia el conductor)
t = Matrix.Rotation(math.radians(-62), 3, "X")
centro_timon = Vector((X_COND, -0.62, 1.68))
cilindro(centro_timon + t @ Vector((0, 0, -0.16)), 0.035, 0.32, "timon", t)
aro(centro_timon, 0.21, 0.018, "timon", t)
for ang in (0, 120, 240):
    r = Matrix.Rotation(math.radians(ang), 3, "Z")
    caja(centro_timon + t @ (r @ Vector((0.1, 0, 0))), (0.2, 0.03, 0.015), "timon", t @ r)
cilindro(centro_timon, 0.06, 0.04, "timon", t)               # centro del timón
# Pedales
for dx in (-0.12, 0.02, 0.15):
    caja((X_COND + dx, -0.78, Z_PISO + 0.1), (0.07, 0.02, 0.1), "timon", Matrix.Rotation(math.radians(30), 3, "X"))

# Sillas: conductor individual y banca de dos puestos
respaldo = Matrix.Rotation(math.radians(12), 3, "X")
def silla(x, ancho):
    caja((x, 0.1, 1.5), (ancho, 0.5, 0.14), "tela")                       # cojín
    caja((x, 0.1, 1.38), (ancho * 0.8, 0.42, 0.12), "costura")             # base
    caja((x, 0.38, 1.88), (ancho, 0.12, 0.66), "tela", respaldo)           # espaldar
    caja((x, 0.44, 2.26), (ancho * 0.5, 0.09, 0.16), "tela", respaldo)     # cabecero
    for dx in (-ancho / 2 + 0.02, ancho / 2 - 0.02):                       # bordes
        caja((x + dx, 0.38, 1.88), (0.03, 0.13, 0.62), "costura", respaldo)
silla(X_COND, 0.52)
silla(X_ACOMP, 0.92)
# Viseras
for x in (X_COND, X_ACOMP):
    caja((x, -0.88, 2.27), (0.5, 0.2, 0.025), "visera", Matrix.Rotation(math.radians(12), 3, "X"))

me_int = bpy.data.meshes.new("CabinaInterior")
bm.to_mesh(me_int)
bm.free()
for k in mats:
    me_int.materials.append(M[k])
if "CabinaInterior" in O:
    bpy.data.objects.remove(O["CabinaInterior"], do_unlink=True)
interior = bpy.data.objects.new("CabinaInterior", me_int)
bpy.context.scene.collection.objects.link(interior)
print("espejos recoloreados:", cambiadas, "| interior:", len(me_int.polygons), "caras")
