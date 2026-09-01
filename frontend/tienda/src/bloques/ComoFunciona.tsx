"use client";

import {
  ClipboardList,
  Package,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * Los pasos para comprar.
 *
 * Antes esta sección estaba escrita dentro de `HomePage.tsx` con exactamente
 * tres pasos, y sus textos vivían en seis columnas de `StoreSettings`
 * (`paso1_titulo`, `paso1_texto`…). El comentario del modelo lo admitía:
 * «siempre 3 pasos fijos, por eso son campos directos».
 *
 * Ahora los pasos son una lista en las propiedades del bloque. Un cuarto paso
 * es un elemento más, no una migración — y un restaurante puede tener dos.
 */
const ICONOS: Record<string, LucideIcon> = {
  search: Search,
  clipboard: ClipboardList,
  truck: Truck,
  package: Package,
  shield: ShieldCheck,
};

export interface Paso {
  titulo: string;
  texto: string;
  icono?: string;
}

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  pasos?: Paso[];
}

export function ComoFunciona({
  kicker = "Cómo funciona",
  titulo = "Pedir es simple",
  subtitulo = "",
  pasos = [],
}: Props) {
  // Sin pasos no hay sección: un encabezado suelto sobre nada es peor que un
  // hueco, porque parece que algo falló al cargar.
  if (pasos.length === 0) return null;

  return (
    <section className="seccion">
      <div className="seccion-titulo">
        <div>
          <span className="seccion-kicker">{kicker}</span>
          <h2>{titulo}</h2>
        </div>
        {subtitulo && <span className="linea">{subtitulo}</span>}
      </div>
      <div className="valores-grid">
        {pasos.map((paso, i) => {
          const Icono = ICONOS[paso.icono ?? ""] ?? Search;
          return (
            <article className="valor-card glass" key={`${paso.titulo}-${i}`}>
              <span className="icono">
                <Icono size={24} />
              </span>
              <h3>
                {i + 1}. {paso.titulo}
              </h3>
              <p>{paso.texto}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
