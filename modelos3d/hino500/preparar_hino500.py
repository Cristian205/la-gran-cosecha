"""
Prepara el Hino 500 para el plano de carga (se ejecuta DENTRO de Blender).

Origen: «2018 Hino 500 Thai Army» de win850850th en Sketchfab
(UID 242b41e522db4e4e99b895fd664af1fd), licencia CC Attribution 4.0.
Se importa con el MCP de Blender (`import_asset`, target_size=8.4) y luego se
corre este script. Es reproducible: el mismo import da el mismo resultado.

Qué hace:
1. Quita la carrocería militar (jaula, barandas, piso y cierre trasero). Queda
   cabina + bastidor + ejes: el furgón lo arma la web con las medidas
   interiores REALES que se registran en el sistema.
2. Separa las ruedas por eje (el modelo junta los dos ejes en una malla).
3. Agrupa en cuatro partes: Cabina, Bastidor, EjeDelantero, EjeTrasero.
4. Reemplaza los materiales (el modelo no trae texturas) por una paleta PBR.
5. Escala a medida real calibrando con la ALTURA TOTAL publicada del Hino 500
   serie FC: 2.470 mm (fichas de exportación de Hino). Las ruedas resultan de
   ~0,85 m de diámetro, coherente con las llantas de la serie.
6. Pivotes: origen del mundo = centro del eje delantero a nivel del piso;
   EjeTrasero con su pivote en el centro de su eje, para ubicarlo en la web
   según la distancia entre ejes configurada del vehículo real.

Ejes de Blender: −Y es el frente del camión, Z arriba. En el GLB (Y arriba) el
frente queda hacia +Z.
"""
import bpy
from mathutils import Matrix, Vector

ALTURA_REAL_M = 2.470  # Hino 500 serie FC, altura total (cabina)
CORTE_EJES_Y = 2.3      # entre el eje delantero y el trasero, en coords. del import

O = bpy.data.objects


def caja(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


# ---------- 1. Fuera la carrocería militar ----------
for o in [o for o in O if o.type == "MESH"]:
    mn, mx = caja(o)
    if mn[1] >= 1.05 and not (mx[2] <= 1.05 and mx[1] <= 5.2):
        bpy.data.objects.remove(o, do_unlink=True)

# El modelo rellena la cabina con un bloque macizo detrás de los vidrios
# (Object_65, «MI_Hino_Body») y unas piezas interiores toscas (asiento y
# planos). Se quitan para dejar la cabina HUECA: el interior se modela aparte
# en `detalle_cabina.py` y se ve a través de los vidrios.
for nombre in ("Object_65", "Object_70", "Object_59", "Object_60"):
    if nombre in O:
        bpy.data.objects.remove(O[nombre], do_unlink=True)

# ---------- 4 (antes de unir). Paleta de materiales ----------
def pbr(nombre, color, metal=0.0, rugos=0.5, alpha=1.0, emision=0.0):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugos
    b.inputs["Alpha"].default_value = alpha
    if emision:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emision
    if alpha < 1:
        m.surface_render_method = "BLENDED"
    m.diffuse_color = (*color, 1)
    return m


P = {
    "pintura": pbr("Hino_Pintura", (0.86, 0.87, 0.86), 0.15, 0.32),
    "oscuro": pbr("Hino_PlasticoOscuro", (0.045, 0.05, 0.055), 0.0, 0.6),
    "rejilla": pbr("Hino_Rejilla", (0.06, 0.065, 0.07), 0.6, 0.35),
    "cromo": pbr("Hino_Cromo", (0.8, 0.8, 0.82), 1.0, 0.15),
    "vidrio": pbr("Hino_Vidrio", (0.05, 0.08, 0.11), 0.0, 0.05, 0.8),
    "faro": pbr("Hino_Faro", (0.9, 0.92, 0.95), 0.0, 0.1, 1.0, 0.3),
    "direccional": pbr("Hino_Direccional", (0.95, 0.45, 0.05), 0.0, 0.25),
    "caucho": pbr("Hino_Caucho", (0.025, 0.025, 0.027), 0.0, 0.85),
    "rin": pbr("Hino_Rin", (0.62, 0.63, 0.65), 0.9, 0.35),
    "cubo": pbr("Hino_Cubo", (0.18, 0.19, 0.2), 0.8, 0.4),
    "chasis": pbr("Hino_Chasis", (0.04, 0.04, 0.045), 0.5, 0.55),
    "tanque": pbr("Hino_Tanque", (0.5, 0.52, 0.54), 0.85, 0.3),
}
# Material original → rol (identificado por la zona que ocupa cada uno).
MAPA = {
    "material_70": "pintura", "MI_Hino_Body": "pintura", "material": "vidrio",
    "Brushed_metal": "rejilla", "Metal": "cromo", "Object_9_sm1": "cromo", "material_0": "cromo",
    "material_73": "direccional", "Material.004": "faro", "Material.005": "faro",
    "material_68": "caucho", "Material_3_1": "rin", "Material_40": "rin",
    "Material_4_1": "cubo", "mat_1": "cubo", "material_65": "tanque",
    "Material.001": "chasis", "material_72": "chasis",
}
for n in ("Material_41", "Material_42", "Material_43", "Material_44", "Material_45", "Material_46", "Material_47"):
    MAPA[n] = "faro"

for o in [o for o in O if o.type == "MESH"]:
    for s in o.material_slots:
        nombre = s.material.name if s.material else ""
        s.material = P[MAPA.get(nombre, "oscuro")]

# ---------- 2. Ruedas por eje ----------
import bmesh  # noqa: E402

RUEDAS = ("Object_26", "Object_35", "Object_56", "Object_62", "Object_66", "Object_67")
for nombre in RUEDAS:
    o = O[nombre]
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(o.data)
    mw = o.matrix_world
    for f in bm.faces:
        f.select = (mw @ f.calc_center_median()).y > CORTE_EJES_Y
    bmesh.update_edit_mesh(o.data)
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")


# ---------- 3. Cuatro partes ----------
def rol(o):
    mn, mx = caja(o)
    cy = (mn[1] + mx[1]) / 2
    if o.name in ("Object_61", "Object_64", "Object_76"):
        return "Bastidor"
    if cy > CORTE_EJES_Y and mx[2] < 1.4:
        return "EjeTrasero"
    if o.name in RUEDAS:
        return "EjeDelantero"
    return "Cabina"


mallas = [o for o in O if o.type == "MESH"]
for o in mallas:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
grupos = {}
for o in mallas:
    grupos.setdefault(rol(o), []).append(o)
for nombre, objs in grupos.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = nombre
    j.data.name = nombre
for o in [o for o in O if o.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)


# ---------- 5. Escala real ----------
def vertices(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def eje_y(o):
    vs = vertices(o)
    zmin = min(v.z for v in vs)
    apoyo = [v.y for v in vs if v.z < zmin + 0.01]
    return sum(apoyo) / len(apoyo), zmin


y_del, suelo = eje_y(O["EjeDelantero"])
y_tra, _ = eje_y(O["EjeTrasero"])
escala = ALTURA_REAL_M / (max(v.z for v in vertices(O["Cabina"])) - suelo)
T = Matrix.Scale(escala, 4) @ Matrix.Translation((0, -y_del, -suelo))
for o in [o for o in O if o.type == "MESH"]:
    o.data.transform(T @ o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    o.data.update()

vs = vertices(O["EjeDelantero"])
RADIO = (max(v.z for v in vs) - min(v.z for v in vs)) / 2
ENTRE_EJES_MODELO = (y_tra - y_del) * escala


# ---------- 6. Pivotes ----------
def origen(o, punto):
    bpy.context.scene.cursor.location = punto
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


origen(O["EjeDelantero"], Vector((0, 0, RADIO)))
origen(O["EjeTrasero"], Vector((0, ENTRE_EJES_MODELO, RADIO)))
origen(O["Cabina"], Vector((0, 0, 0)))
origen(O["Bastidor"], Vector((0, 0, 0)))
bpy.context.scene.cursor.location = (0, 0, 0)

# ---------- 7. Una llanta por lado atrás ----------
# El modelo trae doble llanta trasera («pacha»); el vehículo de la empresa
# lleva UNA por lado. Se quitan la llanta y el rin interiores (piezas sueltas
# entre |x| 0,42 y 0,785 m) y se deja el cubo del eje.
eje = O["EjeTrasero"]
bm = bmesh.new()
bm.from_mesh(eje.data)
bm.faces.ensure_lookup_table()
nombres = [m.name for m in eje.data.materials]
visto, borrar = set(), []
for f in bm.faces:
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
    xs = [abs((eje.matrix_world @ v.co).x) for g in pieza for v in g.verts]
    if min(xs) > 0.42 and max(xs) < 0.785 and nombres[pieza[0].material_index] in ("Hino_Caucho", "Hino_Rin"):
        borrar += pieza
bmesh.ops.delete(bm, geom=list(set(borrar)), context="FACES")
bm.to_mesh(eje.data)
bm.free()
eje.data.update()

for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)

# Medidas que la web necesita para montar el furgón detrás de la cabina.
cab = vertices(O["Cabina"])
bas = [v for v in vertices(O["Bastidor"]) if abs(v.x) < 0.5]
METRICAS = {
    "escala_aplicada": round(escala, 4),
    "radio_rueda_m": round(RADIO, 3),
    "entre_ejes_modelo_m": round(ENTRE_EJES_MODELO, 3),
    "cabina_fondo_y_m": round(max(v.y for v in cab), 3),
    "cabina_frente_y_m": round(min(v.y for v in cab), 3),
    "altura_m": round(max(v.z for v in cab), 3),
    "bastidor_alto_m": round(max(v.z for v in bas), 3),
}
for o in [o for o in O if o.type == "MESH"]:
    print(o.name, len(o.data.polygons), [m.name for m in o.data.materials])
print("METRICAS", METRICAS)
