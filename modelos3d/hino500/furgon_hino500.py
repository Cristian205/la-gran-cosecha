"""
Furgón seco del Hino 500 de la empresa (se ejecuta DENTRO de Blender, después
de `preparar_hino500.py`).

Referencia visual: foto del vehículo de la empresa (Hino 500 con furgón
blanco, perfiles de aluminio, cinta reflectiva roja/blanca, baranda lateral,
defensa trasera y baliza ámbar en la cabina).

MEDIDAS: las de aquí son de REFERENCIA (proporción tomada de la foto), no
especificación. La web reescala la caja a las medidas INTERIORES reales que se
registran en el sistema para cada vehículo. Por eso todo se arma alrededor de
un pivote fijo:

    Furgon (empty)  origen = centro de la pared frontal INTERIOR, a ras del
                    piso de carga. Ejes locales: +Y hacia la puerta, X a lo
                    ancho, Z arriba. La web lo escala (largo, ancho, alto).
      ├─ Furgon_Piso, Furgon_ParedIzq, Furgon_ParedDer, Furgon_ParedFrontal,
      │  Furgon_Techo, Furgon_Estructura, Furgon_Cinta
      ├─ Furgon_PuertaIzq / Furgon_PuertaDer   pivote en su bisagra (abren)
    Furgon_Bajos (empty) mismo pivote, pero la web solo lo estira a lo largo
                    y ancho: travesaños, baranda lateral, defensa y guardafangos
                    no deben crecer con la altura de la caja.
"""
import bpy
import bmesh
from mathutils import Vector

# ---------- Referencia (se reemplaza en la web) ----------
L, W, H = 5.535, 2.30, 2.20         # interior: largo = carrozable 5.635 − paredes; ancho/alto de referencia
T = 0.05                            # espesor de panel sándwich
PISO_T = 0.10                       # espesor del piso
Y0 = 0.69                           # cara exterior frontal (espalda de cabina + holgura)
Z_PISO = 1.10                       # altura del piso de carga sobre el suelo
ENTRE_EJES = 4.350                  # Hino 500 FC9J camión, ficha Hino Colombia

O = bpy.data.objects
for o in [o for o in O if o.name.startswith(("Furgon", "Baliza", "_bisagra"))]:
    bpy.data.objects.remove(o, do_unlink=True)


def mat(nombre, color, metal=0.0, rugos=0.5, emision=0.0):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugos
    if emision:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emision
    m.diffuse_color = (*color, 1)
    return m


M = {
    "panel": mat("Furgon_Panel", (0.93, 0.94, 0.94), 0.0, 0.45),
    "interior": mat("Furgon_Interior", (0.78, 0.79, 0.78), 0.0, 0.7),
    "piso": mat("Furgon_PisoMadera", (0.42, 0.33, 0.24), 0.0, 0.8),
    "alu": mat("Furgon_Aluminio", (0.72, 0.74, 0.76), 0.9, 0.35),
    "rojo": mat("Furgon_ReflectivoRojo", (0.75, 0.04, 0.04), 0.0, 0.3),
    "blanco": mat("Furgon_ReflectivoBlanco", (0.95, 0.95, 0.95), 0.0, 0.3),
    "negro": mat("Hino_Chasis", (0.04, 0.04, 0.045), 0.5, 0.55),
    "caucho": mat("Hino_Caucho", (0.025, 0.025, 0.027), 0.0, 0.85),
    "ambar": mat("Furgon_Ambar", (1.0, 0.55, 0.05), 0.0, 0.2, 0.6),
    "stop": mat("Furgon_Stop", (0.8, 0.02, 0.02), 0.0, 0.2, 0.4),
}


def malla(nombre, cajas, padre):
    """Una malla hecha de cajas [(cx,cy,cz, sx,sy,sz, material)] en coords del padre."""
    bm = bmesh.new()
    mats = []
    for cx, cy, cz, sx, sy, sz, m in cajas:
        if m not in mats:
            mats.append(m)
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r["verts"]:
            v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
        idx = mats.index(m)
        for f in {f for v in r["verts"] for f in v.link_faces}:
            f.material_index = idx
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(M[m])
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = padre
    return o


def vacio(nombre, loc):
    e = bpy.data.objects.new(nombre, None)
    e.empty_display_size = 0.3
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    return e


# Pivote: pared frontal interior, a ras del piso.
raiz = vacio("Furgon", (0, Y0 + T, Z_PISO))
bajos = vacio("Furgon_Bajos", (0, Y0 + T, Z_PISO))

# ---------- Caja ----------
malla("Furgon_Piso", [(0, L / 2, -PISO_T / 2, W + 2 * T, L + T, PISO_T, "piso")], raiz)
malla("Furgon_ParedIzq", [(-(W + T) / 2, L / 2, H / 2, T, L, H, "panel")], raiz)
malla("Furgon_ParedDer", [((W + T) / 2, L / 2, H / 2, T, L, H, "panel")], raiz)
malla("Furgon_ParedFrontal", [(0, -T / 2, H / 2, W + 2 * T, T, H, "panel")], raiz)
malla("Furgon_Techo", [(0, L / 2, H + T / 2, W + 2 * T, L + T, T, "panel")], raiz)

# Perfiles de aluminio: esquinas verticales, largueros superiores e inferiores.
P = 0.07
est = []
for x in (-(W / 2 + T), W / 2 + T):
    for y in (-T, L):
        est.append((x, y, H / 2, P, P, H + T, "alu"))          # esquineros
    est.append((x, L / 2, H + T, P, L + T, P, "alu"))          # larguero superior
    est.append((x, L / 2, -PISO_T, P * 1.2, L + T, P * 1.6, "alu"))  # larguero inferior
est.append((0, -T, H + T, W + 2 * T, P, P, "alu"))             # travesaño superior frontal
# Marco trasero (portal de las puertas)
est += [(0, L + T / 2, H + T / 2 - 0.03, W + 2 * T + 0.04, T * 1.6, 0.12, "alu"),
        (0, L + T / 2, -PISO_T + 0.03, W + 2 * T + 0.04, T * 1.6, 0.12, "alu")]
for x in (-(W / 2 + T / 2), W / 2 + T / 2):
    est.append((x, L + T / 2, H / 2, 0.10, T * 1.6, H + T, "alu"))
malla("Furgon_Estructura", est, raiz)

# Cinta reflectiva roja/blanca a lo largo de los costados y en la parte baja
# de la pared trasera (segmentos de 30 cm alternados).
cinta = []
SEG = 0.30
n = int(L // SEG)
for x in (-(W / 2 + T + 0.005), W / 2 + T + 0.005):
    for i in range(n):
        cinta.append((x, (i + 0.5) * L / n, 0.06, 0.004, L / n * 0.98, 0.05, "rojo" if i % 2 else "blanco"))
malla("Furgon_Cinta", cinta, raiz)

# ---------- Puertas traseras (dos hojas, pivote en la bisagra) ----------
HOJA = W / 2
for lado, signo in (("Izq", -1), ("Der", 1)):
    bisagra = vacio(f"_bisagra{lado}", (signo * (W / 2), L + T, 0))
    bisagra.parent = raiz
    bisagra.location = (signo * (W / 2), L + T, 0)
    # La hoja crece desde la bisagra hacia el centro.
    cx = -signo * HOJA / 2
    piezas = [(cx, T / 2, H / 2, HOJA - 0.01, T, H - 0.02, "panel")]
    for k in (0.28, 0.72):                                         # barras de cierre
        piezas.append((-signo * HOJA * k, T + 0.02, H / 2, 0.03, 0.03, H - 0.1, "alu"))
    for z in (0.35, H - 0.35):                                     # bisagras
        piezas.append((-signo * 0.04, T + 0.015, z, 0.10, 0.03, 0.12, "alu"))
    for i in range(4):                                             # cinta en la puerta
        piezas.append((-signo * (i + 0.5) * HOJA / 4, T + 0.004, 0.10, HOJA / 4 * 0.97, 0.004, 0.05,
                       "rojo" if (i + (signo > 0)) % 2 else "blanco"))
    puerta = malla(f"Furgon_Puerta{lado}", piezas, bisagra)
    puerta.location = (0, 0, 0)

# ---------- Bajos (no escalan con la altura) ----------
b = []
for i in range(int(L / 0.45) + 1):                                 # travesaños
    b.append((0, min(L, i * 0.45), -PISO_T - 0.06, W + 2 * T, 0.06, 0.10, "negro"))
for x in (-0.42, 0.42):                                            # subchasis longitudinal
    b.append((x, L / 2, -PISO_T - 0.16, 0.10, L, 0.14, "negro"))
# Baranda lateral: ENTRE los ejes (no cruza la rueda trasera) y colgada del
# piso con escuadras, a ras del costado de la caja.
Y_EJE_T = ENTRE_EJES - (Y0 + T)        # eje trasero, en coords. del furgón
G0, G1 = 0.20, Y_EJE_T - 0.62         # inicio y fin de la baranda
for x in (-(W / 2 + T) + 0.025, (W / 2 + T) - 0.025):
    for z in (-0.30, -0.50):
        b.append((x, (G0 + G1) / 2, z, 0.05, G1 - G0, 0.07, "alu"))
    for i in range(int((G1 - G0) / 0.6) + 1):                     # escuadras al piso
        y = G0 + 0.05 + i * (G1 - G0 - 0.1) / max(1, int((G1 - G0) / 0.6))
        b.append((x, y, -0.33, 0.05, 0.06, 0.42, "negro"))
    n = 8
    for i in range(n):                                             # cinta en la baranda
        b.append((x + (0.027 if x > 0 else -0.027), G0 + (i + 0.5) * (G1 - G0) / n, -0.50, 0.004,
                  (G1 - G0) / n * 0.95, 0.05, "rojo" if i % 2 else "blanco"))

# Defensa trasera (anti-empotramiento), a ~0,48 m del suelo y UNIDA a la caja:
# dos soportes bajan desde los travesaños y un faldón cierra el hueco.
ZD = -0.55
b.append((0, L + T - 0.02, ZD, W - 0.1, 0.12, 0.14, "alu"))
for i in range(8):
    b.append((-(W - 0.1) / 2 + (i + 0.5) * (W - 0.1) / 8, L + T + 0.042, ZD, (W - 0.1) / 8 * 0.96, 0.004, 0.10,
              "rojo" if i % 2 else "blanco"))
for x in (-0.72, 0.72):
    # Soporte vertical (del travesaño a la defensa) y su refuerzo hacia adelante.
    b.append((x, L + T - 0.06, (ZD - 0.06) / 2, 0.12, 0.14, -ZD + 0.02, "alu"))
    b.append((x, L + T - 0.30, (ZD - 0.06) / 2 + 0.12, 0.08, 0.45, 0.08, "alu"))
    b.append((x * 1.22, L + T + 0.045, ZD + 0.13, 0.22, 0.02, 0.08, "stop"))        # stops
# Placa portaplaca/cierre entre los soportes, a ras de la defensa.
b.append((0, L + T - 0.01, (ZD + 0.05) / 2 - 0.05, 1.3, 0.02, -ZD - 0.2, "negro"))
b.append((0, L + T - 0.03, -0.13, W + 2 * T, 0.06, 0.06, "negro"))   # travesaño trasero
malla("Furgon_BajosMalla", b, bajos)

# Guardafangos (loderas) detrás de la rueda trasera: van con el EJE, no con la
# caja, para seguirlo cuando la web cambia la distancia entre ejes.
lod = []
for x in (-0.95, 0.95):
    # Coordenadas relativas al pivote del eje (centro de la rueda, a 0,423 m):
    # la lodera va de ~0,25 m a ~0,85 m del suelo, 55 cm detrás del eje.
    lod.append((x, 0.55, 0.13, 0.50, 0.012, 0.60, "caucho"))        # lodera
    lod.append((x, 0.55, 0.45, 0.52, 0.05, 0.05, "negro"))          # soporte
malla("Furgon_Loderas", lod, O["EjeTrasero"])

# ---------- Baliza ámbar sobre la cabina (como en la foto) ----------
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.07, depth=0.11, location=(0.55, -0.95, 2.47 + 0.055))
bal = bpy.context.active_object
bal.name = "Baliza"
bal.data.materials.append(M["ambar"])

print("Furgón listo:", sorted(o.name for o in O if o.name.startswith(("Furgon", "Baliza"))))
