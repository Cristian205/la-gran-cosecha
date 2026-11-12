import type { EncabezadoEscena } from "../contenido/tipos";
import { Revelar } from "./Revelar";

/**
 * La cabecera de cada escena: la etiqueta que la identifica, el titular con su
 * parte resaltada y una línea de apoyo. Es la única tipografía grande que se
 * repite, así que vive en un sitio para que las escenas no acaben con cinco
 * escalas distintas.
 */
export function Encabezado({
  datos,
  alineacion = "izquierda",
  id,
}: {
  datos: EncabezadoEscena;
  alineacion?: "izquierda" | "centro";
  id?: string;
}) {
  return (
    <header className={`encabezado encabezado--${alineacion}`}>
      <Revelar>
        <span className="etiqueta">{datos.etiqueta}</span>
      </Revelar>
      <Revelar retraso={0.08}>
        <h2 className="encabezado__titulo" id={id}>
          {datos.titulo} <em>{datos.destacado}</em>
        </h2>
      </Revelar>
      {datos.descripcion && (
        <Revelar retraso={0.16}>
          <p className="encabezado__texto">{datos.descripcion}</p>
        </Revelar>
      )}
    </header>
  );
}
