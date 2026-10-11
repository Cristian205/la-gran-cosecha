import { MotionConfig } from "motion/react";
import { usarContenido } from "./contenido/usarContenido";
import { usarDesplazamientoSuave } from "./hooks/desplazamiento";
import { Navegacion } from "./secciones/Navegacion";
import { Pie } from "./secciones/Pie";
import { RenderSeccion } from "./secciones/registro";

export default function App() {
  const { navegacion, secciones, pie } = usarContenido();
  usarDesplazamientoSuave();

  return (
    // `reducedMotion="user"`: quien pide menos movimiento recibe cada pieza ya
    // colocada, sin que cada componente tenga que comprobarlo por su cuenta.
    <MotionConfig reducedMotion="user">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Navegacion datos={navegacion} />
      <main id="contenido">
        {secciones
          .filter((s) => s.visible)
          .map((s) => (
            <RenderSeccion key={s.id} seccion={s} />
          ))}
      </main>
      <Pie datos={pie} />
    </MotionConfig>
  );
}
