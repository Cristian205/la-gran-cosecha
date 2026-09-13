import { Seccion, claseDeVariante } from "./Seccion";

/**
 * Una o dos columnas de texto libre: historia, misión, política, cualquier
 * prosa que un negocio quiera contar sin que haga falta un bloque nuevo por
 * cada caso. Generico a propósito — igual que `Portada`, lo reutiliza
 * cualquier tienda con sus propias palabras.
 *
 * `whiteSpace: "pre-line"` porque el texto viene como un solo campo (lo
 * escribe el negocio en el constructor, o lo trae una migración de
 * contenido): sin esto, los saltos de línea entre párrafos se colapsarían en
 * un único bloque corrido.
 */
export interface BloqueDeTexto {
  titulo?: string;
  texto: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  bloques?: BloqueDeTexto[];
  variante?: string;
}

const VARIANTES = ["una-columna", "dos-columnas"] as const;

export function TextoLibre({ kicker, titulo, subtitulo, bloques = [], variante }: Props) {
  if (bloques.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "texto-libre", "una-columna");

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div className={clase}>
        {bloques.map((b, i) => (
          <div className="texto-libre-bloque" key={`${b.titulo ?? "bloque"}-${i}`}>
            {b.titulo && <h3>{b.titulo}</h3>}
            <p style={{ whiteSpace: "pre-line" }}>{b.texto}</p>
          </div>
        ))}
      </div>
    </Seccion>
  );
}
