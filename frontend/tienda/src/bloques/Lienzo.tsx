import type { BloqueColocado } from "@/lib/tipos";
import { componenteDe } from "./registro";

/**
 * Pinta una página a partir de su composición.
 *
 * Sustituye al orden escrito a mano que tenía `HomePage.tsx`. Es todo el
 * motor: recorre la lista, busca el componente en el registro y le pasa sus
 * propiedades. Nada más — la inteligencia está en los bloques, no aquí.
 *
 * Es un componente de servidor. Los bloques que necesitan interactividad ya
 * llevan su propio `"use client"`, así que el HTML sale del servidor con el
 * contenido dentro y solo se hidrata lo que de verdad lo necesita.
 */
interface Props {
  bloques: BloqueColocado[];
  /** Lo que el servidor resolvió para los bloques que lo pidieron, por id. */
  datos?: Record<string, unknown>;
  /**
   * Envuelve cada bloque con su identificador, para que el editor pueda
   * señalarlo y seleccionarlo. Fuera del editor no se marca nada: un `div` de
   * más por sección estropearía los selectores de hermano adyacente que la
   * hoja de estilos usa entre secciones.
   */
  marcarBloques?: boolean;
}

const DISPOSITIVOS = ["movil", "tablet", "escritorio"] as const;

export function Lienzo({ bloques, datos = {}, marcarBloques = false }: Props) {
  // Los bloques a sangre salen del contenedor y el resto entra en él. Se
  // agrupan por tramos consecutivos en vez de partir la lista por posición:
  // así el constructor puede subir un carrusel al quinto puesto —o poner dos—
  // sin que ningún bloque de contenido se salga de los márgenes.
  const tramos: { aSangre: boolean; bloques: BloqueColocado[] }[] = [];
  for (const bloque of bloques) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.aSangre === bloque.a_sangre) ultimo.bloques.push(bloque);
    else tramos.push({ aSangre: bloque.a_sangre, bloques: [bloque] });
  }

  return (
    <>
      {tramos.map((tramo, i) =>
        tramo.aSangre ? (
          <Piezas
            key={i}
            bloques={tramo.bloques}
            datos={datos}
            marcar={marcarBloques}
          />
        ) : (
          <div className="contenedor" key={i}>
            <Piezas bloques={tramo.bloques} datos={datos} marcar={marcarBloques} />
          </div>
        )
      )}
    </>
  );
}

function Piezas({
  bloques,
  datos,
  marcar = false,
}: {
  bloques: BloqueColocado[];
  datos: Record<string, unknown>;
  marcar?: boolean;
}) {
  return (
    <>
      {bloques.map((bloque) => {
        const Componente = componenteDe(bloque.tipo);

        // Un bloque que este despliegue no conoce se salta en silencio. El
        // catálogo del backend y el registro se despliegan por separado, así
        // que pueden no coincidir durante unos minutos, y una tienda no puede
        // caerse por eso. En desarrollo sí se avisa, que es donde importa.
        if (!Componente) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[lienzo] no hay componente para «${bloque.tipo}»`);
          }
          return null;
        }

        const pieza = (
          <Componente
            key={bloque.id}
            {...bloque.props}
            variante={bloque.variante || undefined}
            datos={datos[bloque.id]}
          />
        );

        // La visibilidad por dispositivo se resuelve con clases y no
        // devolviendo null: el servidor no sabe con qué pantalla vienen, así
        // que el HTML lleva los tres casos y decide el CSS. El envoltorio solo
        // aparece si de verdad hay algo que ocultar — un div de más por bloque
        // estropearía los selectores de hermano adyacente entre secciones.
        const ocultos = DISPOSITIVOS.filter((d) => !bloque.visible[d])
          .map((d) => `oculto-${d}`)
          .join(" ");

        // En el editor SIEMPRE va envuelto, aunque no haya nada que ocultar:
        // el envoltorio es lo que lleva el identificador con el que se
        // selecciona la sección al pulsarla.
        if (marcar) {
          return (
            <div key={bloque.id} className={`bloque-editable ${ocultos}`.trim()} data-bloque={bloque.id}>
              {pieza}
            </div>
          );
        }

        return ocultos ? (
          <div key={bloque.id} className={ocultos}>
            {pieza}
          </div>
        ) : (
          pieza
        );
      })}
    </>
  );
}
