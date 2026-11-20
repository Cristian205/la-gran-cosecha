import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

/**
 * Vista previa 3D de la canastilla mientras se editan sus medidas: la pila
 * con el máximo de apilado (o 3 si no hay tope), con las proporciones reales.
 */
function Pila({ largo, ancho, alto, niveles }: { largo: number; ancho: number; alto: number; niveles: number }) {
  const { scene } = useGLTF("/modelos/canastilla.glb", false, true);
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
    });
    return g as THREE.BufferGeometry | null;
  }, [scene]);
  const m = 1 / 100;
  return (
    <group>
      {Array.from({ length: niveles }, (_, n) =>
        geo ? (
          <mesh key={n} geometry={geo} position={[0, (n + 0.5) * alto * m, 0]} scale={[largo * m, alto * m * 0.98, ancho * m]}>
            <meshStandardMaterial color={n === niveles - 1 ? "#16a34a" : "#4ade80"} roughness={0.55} />
          </mesh>
        ) : null
      )}
      <mesh position={[0, (niveles * alto * m) / 2, 0]}>
        <boxGeometry args={[largo * m, niveles * alto * m, ancho * m]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#94a3b8" />
      </mesh>
    </group>
  );
}

export default function CanastillaVista3D({ largo, ancho, alto, maxApiladas }: { largo: number; ancho: number; alto: number; maxApiladas: number }) {
  const ok = largo > 0 && ancho > 0 && alto > 0;
  const niveles = Math.min(8, maxApiladas || 3);
  const d = Math.max(largo, ancho, alto * niveles) / 100;
  return (
    <div className="cm-vista3d">
      {ok ? (
        <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 35, position: [d * 1.6, d * 1.3, d * 1.9] }}>
          <color attach="background" args={["#eef1ea"]} />
          <hemisphereLight args={["#ffffff", "#9aa39a", 0.9]} />
          <directionalLight position={[3, 5, 4]} intensity={1.2} />
          <Suspense fallback={null}>
            <Pila largo={largo} ancho={ancho} alto={alto} niveles={niveles} />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} target={[0, (alto * niveles) / 200, 0]} />
        </Canvas>
      ) : (
        <p className="vacio">Escribe las medidas para verla.</p>
      )}
    </div>
  );
}
