"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

export interface Miga {
  etiqueta: string;
  /** Sin `href`, la miga es la página actual. */
  href?: string;
}

/**
 * La ruta hasta la página actual: Inicio › Tienda › Frutas › Mango.
 *
 * En el teléfono no cabe entera, así que los pasos intermedios se colapsan en
 * un "…" y quedan siempre visibles el inicio y la página actual. Tocar el
 * "…" despliega la ruta completa en una sola línea que se desliza de lado,
 * sin romper el layout. El colapso es CSS (no se mide nada): la primera
 * pintura ya sale bien y no hay parpadeo al hidratar.
 */
export function Migas({ migas }: { migas: Miga[] }) {
  const [expandida, setExpandida] = useState(false);
  const listaRef = useRef<HTMLOListElement>(null);

  // Al desplegarla, el "…" desaparece: el foco pasa al primer paso que
  // apareció en vez de perderse, y la línea se lleva al final (dónde estoy).
  useEffect(() => {
    const lista = listaRef.current;
    if (!expandida || !lista) return;
    lista.querySelector<HTMLElement>(".is-intermedia a")?.focus({ preventScroll: true });
    lista.scrollTo({ left: lista.scrollWidth, behavior: "smooth" });
  }, [expandida]);

  const intermedias = migas.length > 2;

  return (
    <nav aria-label="Ruta de navegación" className={`migas-ruta ${expandida ? "is-expandida" : ""}`}>
      <ol ref={listaRef} className="migas-ruta-lista">
        {migas.map((miga, i) => {
          const actual = i === migas.length - 1;
          const intermedia = i > 0 && !actual;
          return (
            <li key={`${i}-${miga.etiqueta}`} className={`migas-ruta-item ${intermedia ? "is-intermedia" : ""}`}>
              {i > 0 && <ChevronRight size={14} className="migas-ruta-sep" aria-hidden="true" />}
              {actual || !miga.href ? (
                <span className="migas-ruta-actual" aria-current={actual ? "page" : undefined} title={miga.etiqueta}>
                  {miga.etiqueta}
                </span>
              ) : (
                <Link href={miga.href} className="migas-ruta-enlace">
                  {miga.etiqueta}
                </Link>
              )}
              {i === 0 && intermedias && (
                <span className="migas-ruta-colapso">
                  <ChevronRight size={14} className="migas-ruta-sep" aria-hidden="true" />
                  <button
                    type="button"
                    className="migas-ruta-mas"
                    onClick={() => setExpandida(true)}
                    aria-expanded={expandida}
                    aria-label="Mostrar la ruta completa"
                  >
                    …
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
