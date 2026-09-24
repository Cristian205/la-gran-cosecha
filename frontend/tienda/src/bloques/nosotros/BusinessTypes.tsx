"use client";

import { useState, type CSSProperties } from "react";
import { TipografiaEditorial } from "../campanas/comunes";
import { Medio, tieneMedio, type MedioDatos } from "./Medio";

/**
 * Para quién existimos: negocios que no pueden parar.
 *
 * En escritorio, una lista de nombres enormes —Restaurantes, Fruterías,
 * Cafeterías…— y a su lado una ventana que cambia con el que está bajo el
 * cursor (o el foco del teclado): su foto y la frase que le toca. En móvil,
 * una fila de tarjetas que se desliza con el pulgar.
 *
 * Cada tipo de negocio acepta su propia foto. Mientras no la tenga, la
 * ventana muestra su ícono sobre el color de marca — nunca una foto de otro
 * negocio.
 */
export interface TipoNegocio extends MedioDatos {
  nombre?: string;
  texto?: string;
  /** Archivo de `/public/icons3d` (ej. "restaurante.png") para cuando no hay foto. */
  icono?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  mensaje?: string;
  tipos?: TipoNegocio[];
}

export function BusinessTypes({ kicker = "", titulo = "", titulo_resaltado = "", mensaje = "", tipos = [] }: Props) {
  const lista = tipos.filter((t) => t.nombre);
  const [activo, setActivo] = useState(0);
  if (!titulo || lista.length === 0) return null;

  return (
    <section className="nn">
      <TipografiaEditorial />
      <div className="cmp-inner">
        <header className="nn-cabecera">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2>
            {titulo}
            {titulo_resaltado && <em> {titulo_resaltado}</em>}
          </h2>
          {mensaje && <p className="nn-mensaje">{mensaje}</p>}
        </header>

        <div className="nn-cuerpo">
          <ul className="nn-lista">
            {lista.map((t, i) => (
              <li key={`${t.nombre}-${i}`}>
                <button
                  type="button"
                  className={`nn-nombre ${i === activo ? "activo" : ""}`}
                  aria-pressed={i === activo}
                  onMouseEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onClick={() => setActivo(i)}
                >
                  <span className="nn-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  {t.nombre}
                </button>
              </li>
            ))}
          </ul>

          <div className="nn-ventana" aria-live="polite">
            {lista.map((t, i) => (
              <article
                key={`${t.nombre}-${i}`}
                className={`nn-escena ${i === activo ? "activa" : ""}`}
                aria-hidden={i === activo ? undefined : true}
              >
                <Visual tipo={t} />
                <div className="nn-escena-texto">
                  <h3>{t.nombre}</h3>
                  {t.texto && <p>{t.texto}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Móvil: la misma información como tarjetas deslizables. */}
        <ul className="nn-tarjetas">
          {lista.map((t, i) => (
            <li key={`${t.nombre}-${i}`} className="nn-tarjeta" style={{ "--i": i } as CSSProperties}>
              <Visual tipo={t} />
              <div className="nn-escena-texto">
                <h3>{t.nombre}</h3>
                {t.texto && <p>{t.texto}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Visual({ tipo }: { tipo: TipoNegocio }) {
  if (tieneMedio(tipo)) return <Medio {...tipo} className="nn-medio" />;
  return (
    <div className="nn-medio nn-medio--icono" aria-hidden="true">
      {tipo.icono && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/icons3d/${tipo.icono}`} alt="" loading="lazy" decoding="async" />
      )}
    </div>
  );
}
