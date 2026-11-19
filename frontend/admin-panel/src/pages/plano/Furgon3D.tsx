import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Furgon, GrupoCarga, Posicion, Rejilla } from "../../api/logistica";
import { alturaPila } from "./acomodo";

/**
 * El visor 3D del plano de carga. Todo en metros (las medidas llegan en cm).
 *
 * Ejes de la escena: X a lo largo (−X = cabina, +X = puerta), Z a lo ancho,
 * Y arriba. El origen es el centro del piso de carga: el interior del furgón
 * ocupa X ∈ [−L/2, L/2], Z ∈ [−W/2, W/2], Y ∈ [0, H].
 *
 * El vehículo es un modelo 3D real (public/modelos/*.glb, hecho en Blender:
 * ver modelos3d/) que se AJUSTA a las medidas interiores registradas: la caja
 * se escala a L × W × H y el eje trasero se ubica con la distancia entre ejes.
 * Las canastillas usan public/modelos/canastilla.glb (unitario) escalado a la
 * medida real de la canastilla.
 */

export type Vista = "3d" | "superior" | "lateral" | "trasera";

export interface OpcionesVisor {
  techo: boolean;
  paredes: boolean;
  puertasAbiertas: boolean;
}

interface Props {
  rejilla: Rejilla;
  furgon: Furgon | null;
  grupos: GrupoCarga[];
  posiciones: Posicion[];
  seleccion: Posicion | null;
  resaltado: string | null;
  vista: Vista;
  opciones: OpcionesVisor;
  editable: boolean;
  onCanastilla: (p: Posicion) => void;
  onPila: (fila: number, columna: number) => void;
  onFondo: () => void;
}

const M = 1 / 100;
const HUECO = 0.96;

// Medidas INTERIORES con las que se modeló el furgón en Blender
// (modelos3d/hino500/furgon_hino500.py). La web escala desde ellas. El largo
// sale del largo carrozable oficial del Hino 500 FC9J camión (5.635 mm, Hino
// Colombia) menos las paredes; ancho y alto son de referencia. El modelo trae
// la distancia entre ejes oficial (4.350 mm); si el vehículo registra otra,
// el eje trasero se reubica.
const HINO = {
  url: "/modelos/hino500.glb",
  ref: { largo: 5.535, ancho: 2.3, alto: 2.2 },
};
const CANASTILLA_URL = "/modelos/canastilla.glb";

function medidas(r: Rejilla) {
  const L = r.furgon.largo * M;
  const W = r.furgon.ancho * M;
  const H = r.furgon.alto * M;
  const sl = (r.girada ? r.canastilla.ancho : r.canastilla.largo) * M;
  const sw = (r.girada ? r.canastilla.largo : r.canastilla.ancho) * M;
  const sh = r.canastilla.alto * M;
  return { L, W, H, sl, sw, sh };
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
function Camara({ vista, L, W, H }: { vista: Vista; L: number; W: number; H: number }) {
  const { camera, invalidate } = useThree();
  const controles = useThree((s) => s.controls) as OrbitControlsImpl | null;

  useEffect(() => {
    const d = Math.max(L + 2.4, W, H);
    const pos: Record<Vista, [number, number, number]> = {
      "3d": [L * 0.55, H + d * 0.42, W + d * 0.62],
      superior: [0.001, d * 1.25, 0],
      lateral: [0, H / 2, d * 1.05],
      trasera: [L / 2 + d * 0.62, H * 0.7, 0],
    };
    camera.position.set(...pos[vista]);
    const objetivo: [number, number, number] = [vista === "superior" || vista === "trasera" ? 0 : -0.6, vista === "superior" ? 0 : H / 3, 0];
    if (controles) {
      controles.target.set(...objetivo);
      controles.update();
    } else {
      camera.lookAt(...objetivo);
    }
    invalidate();
  }, [vista, L, W, H, camera, controles, invalidate]);

  return null;
}

// ---------------------------------------------------------------------------
// Vehículo: Hino 500 real, ajustado a las medidas registradas
// ---------------------------------------------------------------------------
function CamionHino({ L, W, H, furgon, opciones }: { L: number; W: number; H: number; furgon: Furgon | null; opciones: OpcionesVisor }) {
  const { scene } = useGLTF(HINO.url, false, true);
  const { invalidate } = useThree();
  const modelo = useMemo(() => {
    const m = scene.clone(true);
    // El camión es decorado: no atrapa clics. Así se puede elegir CUALQUIER
    // canastilla del furgón aunque una pared, el techo o la cabina queden
    // delante desde el ángulo de la cámara.
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.raycast = () => {};
    });
    return m;
  }, [scene]);

  // Ajuste a medidas y pivotes (se recalcula si cambian).
  const desplazamiento = useMemo(() => {
    const caja = modelo.getObjectByName("Furgon");
    const bajos = modelo.getObjectByName("Furgon_Bajos");
    const ejeT = modelo.getObjectByName("EjeTrasero");
    if (caja) caja.scale.set(W / HINO.ref.ancho, H / HINO.ref.alto, L / HINO.ref.largo);
    if (bajos) bajos.scale.set(W / HINO.ref.ancho, 1, L / HINO.ref.largo);
    if (ejeT && furgon?.distancia_entre_ejes_mm) {
      // En el GLB el largo va por −Z: el eje trasero queda a −(entre ejes).
      ejeT.position.z = -furgon.distancia_entre_ejes_mm / 1000;
    }
    // El pivote del furgón (pared frontal interior, a ras del piso) va a
    // (−L/2, 0, 0). El grupo gira −90° en Y, que lleva (x, y, z) → (−z, y, x).
    const p = caja ? caja.position : new THREE.Vector3();
    return new THREE.Vector3(-L / 2 - -p.z, -p.y, -p.x);
  }, [modelo, L, W, H, furgon?.distancia_entre_ejes_mm]);

  useEffect(() => {
    const ver = (n: string, v: boolean) => {
      const o = modelo.getObjectByName(n);
      if (o) o.visible = v;
    };
    ver("Furgon_Techo", opciones.techo);
    ver("Furgon_ParedIzq", opciones.paredes);
    ver("Furgon_ParedDer", opciones.paredes);
    ver("Furgon_Cinta", opciones.paredes);
    const abrir = opciones.puertasAbiertas ? 1 : 0;
    const izq = modelo.getObjectByName("_bisagraIzq");
    const der = modelo.getObjectByName("_bisagraDer");
    if (izq) izq.rotation.y = abrir * (-Math.PI * 0.55);
    if (der) der.rotation.y = abrir * (Math.PI * 0.55);
    invalidate();
  }, [modelo, opciones, invalidate]);

  return (
    <group position={desplazamiento} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={modelo} />
    </group>
  );
}

/** Para vehículos sin modelo 3D: la caja del furgón y una cabina sencilla. */
function CamionGenerico({ L, W, H, opciones }: { L: number; W: number; H: number; opciones: OpcionesVisor }) {
  const cab = Math.min(1.6, L * 0.3);
  return (
    <group>
      <mesh position={[0, H / 2, 0]} visible={opciones.paredes || opciones.techo}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color="#cfd5dc" transparent opacity={0.12} depthWrite={false} />
        <Edges color="#5b6470" />
      </mesh>
      <mesh position={[-L / 2 - cab / 2 - 0.1, H * 0.25, 0]}>
        <boxGeometry args={[cab, H * 1.1, W * 0.95]} />
        <meshStandardMaterial color="#e8eaec" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Canastillas
// ---------------------------------------------------------------------------
function useGeometriaCanastilla() {
  const { scene } = useGLTF(CANASTILLA_URL, false, true);
  return useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry;
    });
    return geo as THREE.BufferGeometry | null;
  }, [scene]);
}

function clicSinArrastre(e: ThreeEvent<MouseEvent>) {
  e.stopPropagation();
  return e.delta <= 4;
}

function cursor(valor: string) {
  return () => {
    document.body.style.cursor = valor;
  };
}

function Carga(props: Props & { L: number; W: number; sl: number; sw: number; sh: number }) {
  const { rejilla, grupos, posiciones, seleccion, resaltado, editable, L, W, sl, sw, sh } = props;
  const geo = useGeometriaCanastilla();
  const materiales = useMemo(() => {
    const m = new Map<string, THREE.MeshStandardMaterial>();
    for (const g of grupos) m.set(g.id, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.55, metalness: 0 }));
    return m;
  }, [grupos]);
  const atenuados = useMemo(() => {
    const m = new Map<string, THREE.MeshStandardMaterial>();
    for (const g of grupos)
      m.set(g.id, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false }));
    return m;
  }, [grupos]);
  const elegidaMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#a3d917", emissiveIntensity: 0.6 }), []);
  useEffect(() => () => {
    materiales.forEach((m) => m.dispose());
    atenuados.forEach((m) => m.dispose());
  }, [materiales, atenuados]);

  // Medida REAL de la canastilla (no del hueco), y su giro si va atravesada.
  const c = rejilla.canastilla;
  const escala: [number, number, number] = [c.largo * M * 0.985, c.alto * M * 0.985, c.ancho * M * 0.985];
  const giro: [number, number, number] = [0, rejilla.girada ? Math.PI / 2 : 0, 0];

  const centro = (fila: number, columna: number, nivel: number): [number, number, number] => [
    -L / 2 + (fila + 0.5) * sl,
    nivel * sh + sh / 2,
    -W / 2 + (columna + 0.5) * sw,
  ];
  const esSel = (p: Posicion) =>
    !!seleccion && seleccion.fila === p.fila && seleccion.columna === p.columna && seleccion.nivel === p.nivel;

  const destinos = useMemo(() => {
    if (!seleccion || !editable) return [];
    const lista: Array<{ fila: number; columna: number; nivel: number }> = [];
    for (let fila = 0; fila < rejilla.filas; fila++)
      for (let columna = 0; columna < rejilla.columnas; columna++) {
        if (fila === seleccion.fila && columna === seleccion.columna) continue;
        const nivel = alturaPila(posiciones, fila, columna);
        if (nivel < rejilla.niveles) lista.push({ fila, columna, nivel });
      }
    return lista;
  }, [seleccion, editable, posiciones, rejilla]);

  return (
    <group>
      {posiciones.map((p) => {
        const elegida = esSel(p);
        const tenue = (resaltado && p.grupo !== resaltado) || (seleccion && !elegida && seleccion.grupo !== p.grupo);
        const material = elegida ? elegidaMat : tenue ? atenuados.get(p.grupo) : materiales.get(p.grupo);
        const pos = centro(p.fila, p.columna, p.nivel);
        return geo ? (
          <mesh
            key={`${p.fila}:${p.columna}:${p.nivel}`}
            geometry={geo}
            material={material}
            position={pos}
            rotation={giro}
            scale={escala}
            onClick={(e) => {
              if (clicSinArrastre(e)) props.onCanastilla(p);
            }}
            onPointerOver={editable ? cursor("pointer") : undefined}
            onPointerOut={editable ? cursor("") : undefined}
          />
        ) : (
          <mesh key={`${p.fila}:${p.columna}:${p.nivel}`} position={pos} material={material}>
            <boxGeometry args={[sl * HUECO, sh * HUECO, sw * HUECO]} />
          </mesh>
        );
      })}

      {destinos.map((d) => (
        <mesh
          key={`d${d.fila}:${d.columna}`}
          position={centro(d.fila, d.columna, d.nivel)}
          onClick={(e) => {
            if (clicSinArrastre(e)) props.onPila(d.fila, d.columna);
          }}
          onPointerOver={cursor("copy")}
          onPointerOut={cursor("")}
        >
          <boxGeometry args={[sl * HUECO, sh * HUECO, sw * HUECO]} />
          <meshBasicMaterial color="#a3d917" transparent opacity={0.25} depthWrite={false} />
          <Edges color="#3a7d0c" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
export default function Furgon3D(props: Props) {
  const { rejilla, vista, opciones, furgon } = props;
  const { L, W, H, sl, sw, sh } = medidas(rejilla);
  const conModelo = furgon?.modelo_3d === "hino500";
  // Altura del piso de carga sobre el suelo (para dibujar el suelo).
  const pisoSobreSuelo = conModelo ? 1.1 : 0.9;

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return (
    <div className="plano-3d">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 38, near: 0.05, far: 300, position: [L, H * 2, W * 2] }}
        onPointerMissed={() => props.onFondo()}
      >
        <color attach="background" args={["#e9ece6"]} />
        {/* El suelo se funde con el fondo a lo lejos: sin borde visible. */}
        <fog attach="fog" args={["#e9ece6", 14, 34]} />
        <hemisphereLight args={["#ffffff", "#9aa39a", 0.85]} />
        <directionalLight position={[L * 0.6, H * 4, W * 3]} intensity={1.35} />
        <directionalLight position={[-L, H * 2, -W * 3]} intensity={0.45} />

        {/* Suelo */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.8, -pisoSobreSuelo - 0.002, 0]}>
          <circleGeometry args={[80, 48]} />
          <meshStandardMaterial color="#d9ddd5" />
        </mesh>

        {/* Rejilla del piso de carga: dónde cae cada hueco */}
        <group position={[0, 0.003, 0]}>
          {Array.from({ length: rejilla.filas + 1 }, (_, i) => (
            <mesh key={`f${i}`} position={[-L / 2 + i * sl, 0, -W / 2 + (rejilla.columnas * sw) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.01, rejilla.columnas * sw]} />
              <meshBasicMaterial color="#8c7a63" />
            </mesh>
          ))}
          {Array.from({ length: rejilla.columnas + 1 }, (_, j) => (
            <mesh key={`c${j}`} position={[-L / 2 + (rejilla.filas * sl) / 2, 0, -W / 2 + j * sw]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[rejilla.filas * sl, 0.01]} />
              <meshBasicMaterial color="#8c7a63" />
            </mesh>
          ))}
        </group>

        <Suspense fallback={null}>
          {conModelo ? (
            <CamionHino L={L} W={W} H={H} furgon={furgon} opciones={opciones} />
          ) : (
            <CamionGenerico L={L} W={W} H={H} opciones={opciones} />
          )}
          <Carga {...props} L={L} W={W} sl={sl} sw={sw} sh={sh} />
        </Suspense>

        <Html position={[L / 2 + 0.35, 0.2, 0]} center className="plano-etiqueta plano-etiqueta--puerta">
          Puerta
        </Html>

        <OrbitControls makeDefault enableDamping={false} minDistance={1.5} maxDistance={40} maxPolarAngle={Math.PI / 2 - 0.03} />
        <Camara vista={vista} L={L} W={W} H={H} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(HINO.url, false, true);
useGLTF.preload(CANASTILLA_URL, false, true);
