"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { TipografiaEditorial } from "../campanas/comunes";
import { Medio, tieneMedio, type MedioDatos } from "../nosotros/Medio";

/**
 * "Así podemos ayudarte": cuatro situaciones reales, cada una con su salida.
 *
 * No repite "Para quién existimos" de /nosotros (que cuenta a quién sirve el
 * negocio): aquí cada escenario termina en una ACCIÓN —cotizar, ver
 * productos, buscar un producto—. Una tarjeta sin botón no tendría razón de
 * estar en esta página.
 *
 * Cada escenario acepta su propia foto; mientras no la tenga, muestra su
 * ícono sobre el color de marca, nunca una foto de otro negocio.
 */
interface Escenario extends MedioDatos {
  titulo?: string;
  texto?: string;
  cta_texto?: string;
  cta_href?: string;
  /** Archivo de `/public/icons3d`, para cuando no hay foto. */
  icono?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  escenarios?: Escenario[];
}

export function ContactScenarios({ kicker = "", titulo = "", titulo_resaltado = "", escenarios = [] }: Props) {
  const lista = escenarios.filter((e) => e.titulo);
  if (!titulo || lista.length === 0) return null;

  return (
    <section className="ct-esc" aria-labelledby="ct-esc-titulo">
      <TipografiaEditorial />
      <div className="cmp-inner">
        <header className="ct-esc-cabecera">
          {kicker && <p className="cmp-kicker">{kicker}</p>}
          <h2 id="ct-esc-titulo">
            {titulo}
            {titulo_resaltado && <em> {titulo_resaltado}</em>}
          </h2>
        </header>
        <ul className="ct-esc-lista">
          {lista.map((e, i) => (
            <motion.li
              key={`${e.titulo}-${i}`}
              className="ct-esc-tarjeta"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
            >
                <div className="ct-esc-visual">
                  {tieneMedio(e) ? (
                    <Medio {...e} />
                  ) : (
                    e.icono && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="ct-esc-icono" src={`/icons3d/${e.icono}`} alt="" loading="lazy" decoding="async" />
                    )
                  )}
                </div>
                <div className="ct-esc-cuerpo">
                  <h3>{e.titulo}</h3>
                  {e.texto && <p>{e.texto}</p>}
                  {e.cta_texto && e.cta_href && (
                    <Link className="ct-esc-cta" href={e.cta_href}>
                      {e.cta_texto} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
