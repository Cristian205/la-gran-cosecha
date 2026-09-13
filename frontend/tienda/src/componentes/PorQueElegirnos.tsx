"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { desempaquetar, obtenerBeneficios } from "@/lib/datos";
import type { BeneficioComercial, Paginated } from "@/lib/tipos";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";
import { Reveal } from "@/componentes/animacion";
import { ICONOS as ICONOS_COMUNES } from "@/bloques/iconos";
import { icono3D, type ComponenteIcono } from "@/bloques/iconos3d";

/**
 * `rejilla` da a cada beneficio su tarjeta; `lista` los pone en una columna con
 * el icono al lado del texto. La rejilla luce con cuatro o seis y se desarma
 * con dos; la lista aguanta cualquier numero y ocupa la mitad de alto, que es
 * lo que pide un pagina larga donde esto no es el argumento principal.
 *
 * El componente ya importaba `claseDeVariante` sin usarlo: declaraba cero
 * variantes en el catalogo y pintaba siempre lo mismo.
 *
 * `marmol` es la mas editorial: encabezado centrado en serif sobre un fondo
 * de marmol, tarjetas mas altas con el icono en una caja cuadrada verde
 * pastel. No usa `Seccion` — ese encabezado (kicker a la izquierda, linea a
 * la derecha) es otra composicion, y forzarla aqui habria significado un
 * monton de props para apagar piezas en vez de dibujar la de esta variante.
 *
 * El fondo de esa variante es un degradado por CSS que sirve de respaldo
 * para cualquier tienda, pero admite una foto propia via `imagen_fondo`: el
 * marmol de un negocio no puede quedar grabado en el codigo para que todos
 * los demas lo hereden — mismo criterio que `imagen_url` en el separador
 * "Cinta de marca".
 */
const VARIANTES = ["rejilla", "lista", "marmol"] as const;

const ICONOS: Record<BeneficioComercial["icono"], ComponenteIcono> = {
  truck: ICONOS_COMUNES.camion,
  clock: ICONOS_COMUNES.reloj,
  package: ICONOS_COMUNES.caja,
  wallet: icono3D("pqe-wallet.png"),
  headset: ICONOS_COMUNES.soporte,
  check: icono3D("pqe-check.png"),
  shield: ICONOS_COMUNES.escudo,
  users: icono3D("pqe-usuarios.png"),
  basket: ICONOS_COMUNES.canasta,
};

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
  variante?: string;
  /** Lo que el lienzo ya resolvió en el servidor (ver `RESUELVE_EN_SERVIDOR`
   *  en `lib/pagina.ts`). Sin esto, la sección se pintaba vacía en el HTML
   *  del servidor y solo aparecía al hidratar. */
  datos?: Paginated<BeneficioComercial> | BeneficioComercial[];
  /** Solo la usa `marmol`: una foto propia en vez del degradado de respaldo. */
  imagen_fondo?: string;
}

export function PorQueElegirnos({
  kicker = "Confianza",
  titulo = "¿Por qué comprar con nosotros?",
  subtitulo,
  limite,
  variante,
  datos,
  imagen_fondo = "",
}: Props) {
  const [beneficios, setBeneficios] = useState<BeneficioComercial[]>(() =>
    datos ? desempaquetar(datos) : []
  );

  useEffect(() => {
    // Ya vinieron resueltas del servidor: pedirlas de nuevo sería trabajo
    // tirado, el mismo criterio que ya aplican `MasVendidos`/`CategoriasDestacadas`.
    if (beneficios.length > 0) return;
    obtenerBeneficios()
      .then(setBeneficios)
      .catch(() => setBeneficios([]));
  }, [beneficios.length]);

  const visibles = limite ? beneficios.slice(0, limite) : beneficios;
  if (visibles.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "valores", "rejilla");

  if (clase === "valores--marmol") {
    return (
      <Reveal
        as="section"
        className="pqe-marmol"
        style={imagen_fondo ? ({ "--pqe-marmol-fondo": `url(${imagen_fondo})` } as CSSProperties) : undefined}
      >
        <div className="pqe-marmol-header">
          {kicker && <span className="pqe-marmol-kicker">{kicker}</span>}
          {titulo && <h2>{titulo}</h2>}
        </div>
        <div className="pqe-marmol-grid">
          {visibles.map((b, i) => {
            const Icono = ICONOS[b.icono] ?? ICONOS.check;
            return (
              <Reveal
                as="article"
                className="pqe-marmol-card"
                retraso={Math.min(i, 5) * 0.08}
                key={b.id}
              >
                <span className="pqe-marmol-icono">
                  <Icono size={34} />
                </span>
                <h3>{b.titulo}</h3>
                {b.texto && <p>{b.texto}</p>}
              </Reveal>
            );
          })}
        </div>
      </Reveal>
    );
  }

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div className={`valores-grid ${clase}`}>
        {visibles.map((b, i) => {
          const Icono = ICONOS[b.icono] ?? ICONOS.check;
          return (
            <Reveal as="article" className="valor-card glass" retraso={Math.min(i, 5) * 0.08} key={b.id}>
              <span className="icono">
                <Icono size={24} />
              </span>
              <h3>{b.titulo}</h3>
              {b.texto && <p>{b.texto}</p>}
            </Reveal>
          );
        })}
      </div>
    </Seccion>
  );
}
