import { Fragment, type CSSProperties } from "react";
import type { BloqueColocado } from "@/lib/tipos";
import { variablesDeBloque } from "@/lib/tema";
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
 *
 * # El ámbito de estilo
 *
 * Desde la fase 12 un bloque puede traer su propio aspecto —`estilo`, ya como
 * variables CSS—. Se aplica en un envoltorio y no en el componente porque las
 * variables CSS se HEREDAN: poniéndolas arriba, todo lo que hay dentro de la
 * sección las lee sin que ningún bloque tenga que saber que existen. Una
 * sección con `--superficie` propio pinta sus tarjetas de ese color sin una
 * sola línea nueva en la tarjeta.
 *
 * Y el envoltorio va FUERA del contenedor. Es la diferencia entre un fondo de
 * sección y un rectángulo de color con los márgenes de la página a los lados:
 * el color sangra de borde a borde y el contenido sigue alineado con el resto.
 */
interface Props {
  bloques: BloqueColocado[];
  /** Lo que el servidor resolvió para los bloques que lo pidieron, por id. */
  datos?: Record<string, unknown>;
  /**
   * Envuelve cada bloque con su identificador, para que el editor pueda
   * señalarlo y seleccionarlo. Fuera del editor no se marca lo que no hace
   * falta: un `div` de más por sección es DOM que nadie pidió.
   */
  marcarBloques?: boolean;
}

const DISPOSITIVOS = ["movil", "tablet", "escritorio"] as const;

/** Si este bloque trae aspecto propio. Decide si necesita su propio ámbito. */
function tieneEstilo(bloque: BloqueColocado): boolean {
  return Boolean(bloque.estilo && Object.keys(bloque.estilo).length > 0);
}

export function Lienzo({ bloques, datos = {}, marcarBloques = false }: Props) {
  // Los bloques a sangre salen del contenedor y el resto entra en él. Se
  // agrupan por tramos consecutivos en vez de partir la lista por posición:
  // así el constructor puede subir un carrusel al quinto puesto —o poner dos—
  // sin que ningún bloque de contenido se salga de los márgenes.
  //
  // Un bloque con estilo propio ROMPE el tramo y se queda solo. Tiene que ser
  // así: su ámbito envuelve al contenedor, no al revés, y si compartiera tramo
  // con el vecino le teñiría el fondo a él también.
  const tramos: { aSangre: boolean; suelto: boolean; bloques: BloqueColocado[] }[] = [];
  for (const bloque of bloques) {
    const suelto = tieneEstilo(bloque);
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && !ultimo.suelto && !suelto && ultimo.aSangre === bloque.a_sangre) {
      ultimo.bloques.push(bloque);
    } else {
      tramos.push({ aSangre: bloque.a_sangre, suelto, bloques: [bloque] });
    }
  }

  return (
    <>
      {tramos.map((tramo, i) => {
        const contenido = (
          <Piezas bloques={tramo.bloques} datos={datos} marcar={marcarBloques} />
        );

        if (tramo.suelto) {
          const bloque = tramo.bloques[0];
          return (
            <div
              key={bloque.id}
              className="bloque-ambito"
              style={variablesDeBloque(bloque.estilo) as CSSProperties}
            >
              {bloque.a_sangre ? contenido : <div className="contenedor">{contenido}</div>}
            </div>
          );
        }

        // A sangre va sin envoltorio: un `div` de más aquí sería DOM que nadie
        // pidió, y el fragmento lleva la clave igual.
        return tramo.aSangre ? (
          <Fragment key={i}>{contenido}</Fragment>
        ) : (
          <div className="contenedor" key={i}>
            {contenido}
          </div>
        );
      })}
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
        // es DOM que nadie pidió.
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
