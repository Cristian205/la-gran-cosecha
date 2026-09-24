"use client";

import { Plus } from "lucide-react";
import { Reveal } from "@/componentes/animacion";
import { Boton, TipografiaEditorial } from "../campanas/comunes";
import { ENLACE_DE } from "./intenciones";

/**
 * "¿No lo encuentras? Pregúntanos.": el catálogo no es un límite.
 *
 * El visual es la idea: una estantería de producto real que se sale de su
 * marco, y en medio un hueco punteado —"lo que buscas"— que invita a
 * llenarlo. El botón abre el camino "Busco un producto" del selector.
 *
 * La `nota` existe para no prometer de más: se revisa si se consigue y se
 * confirma disponibilidad y precio. Nada de "lo conseguimos todo".
 */
interface Foto {
  imagen?: string;
  alt?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  ejemplos?: string[];
  nota?: string;
  cta_texto?: string;
  cta_href?: string;
  hueco_texto?: string;
  fotos?: Foto[];
}

export function NotInCatalog({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  ejemplos = [],
  nota = "",
  cta_texto = "",
  cta_href = ENLACE_DE.producto,
  hueco_texto = "Lo que buscas",
  fotos = [],
}: Props) {
  if (!titulo) return null;

  const imagenes = fotos.filter((f) => f.imagen).slice(0, 7);
  // El hueco va en el centro de la estantería, no al final: se lee como
  // "falta algo aquí", no como "fin de la lista".
  const mitad = Math.min(4, Math.floor(imagenes.length / 2));
  const piezas: (Foto | null)[] = [...imagenes.slice(0, mitad), null, ...imagenes.slice(mitad)];

  return (
    <section className="ct-esp" aria-labelledby="ct-esp-titulo">
      <TipografiaEditorial />
      <div className="cmp-inner ct-esp-grid">
        <Reveal className="ct-esp-texto">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2 id="ct-esp-titulo">
            {titulo}
            {titulo_resaltado && <em>{titulo_resaltado}</em>}
          </h2>
          {texto && <p className="ct-esp-parrafo">{texto}</p>}
          {ejemplos.filter(Boolean).length > 0 && (
            <ul className="ct-esp-ejemplos">
              {ejemplos.filter(Boolean).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {cta_texto && (
            <div className="ct-esp-accion">
              <Boton href={cta_href || ENLACE_DE.producto} variante="oscuro">
                {cta_texto}
              </Boton>
            </div>
          )}
          {nota && <p className="ct-esp-nota">{nota}</p>}
        </Reveal>

        <div className="ct-esp-estante" aria-hidden="true">
          {piezas.map((f, i) =>
            f ? (
              <Reveal key={`${f.imagen}-${i}`} className="ct-esp-pieza" retraso={i * 0.06}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imagen} alt="" loading="lazy" decoding="async" />
              </Reveal>
            ) : (
              <Reveal key="hueco" className="ct-esp-pieza ct-esp-hueco" retraso={i * 0.06}>
                <span className="ct-esp-hueco-mas">
                  <Plus size={26} />
                </span>
                <span>{hueco_texto}</span>
              </Reveal>
            )
          )}
        </div>
      </div>
    </section>
  );
}
