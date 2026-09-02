"use client";

import {
  ClipboardList,
  Package,
  Search,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

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
/**
 * Los nombres que esta seccion ya tenia guardados en las tiendas existentes.
 *
 * Se conservan aunque el catalogo compartido use otros: son datos que estan en
 * la base de cada negocio, y renombrarlos dejaria sin icono a quien no vuelva a
 * editar su pagina. Lo que no este aqui se busca en el mapa comun.
 */
const HEREDADOS: Record<string, LucideIcon> = {
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
  variante?: string;
}

/**
 * `tarjetas` es como se veia esta seccion desde siempre; `linea` la pone en
 * fila, numerada y con el hilo que une un paso con el siguiente.
 *
 * Es una variante y no un bloque nuevo a proposito: los datos son exactamente
 * los mismos —los mismos pasos, los mismos iconos— y lo unico que cambia es
 * como se dibujan. Un bloque aparte habria duplicado el esquema de propiedades
 * y obligado a mantener dos.
 */
const VARIANTES = ["tarjetas", "linea"] as const;

export function ComoFunciona({
  kicker = "Cómo funciona",
  titulo = "Pedir es simple",
  subtitulo = "",
  pasos = [],
  variante,
}: Props) {
  // Sin pasos no hay sección: un encabezado suelto sobre nada es peor que un
  // hueco, porque parece que algo falló al cargar.
  if (pasos.length === 0) return null;

  const clase = claseDeVariante(variante, VARIANTES, "pasos", "tarjetas");
  const enLinea = clase.endsWith("linea");

  return (
    <section className="seccion">
      <div className="seccion-titulo" style={enLinea ? { justifyContent: "center" } : undefined}>
        <div>
          {kicker && !enLinea && <span className="seccion-kicker">{kicker}</span>}
          <h2>{titulo}</h2>
        </div>
        {subtitulo && !enLinea && <span className="linea">{subtitulo}</span>}
      </div>

      <div className={enLinea ? `pasos ${clase}` : "valores-grid"}>
        {pasos.map((paso, i) => {
          const Icono = HEREDADOS[paso.icono ?? ""] ?? icono(paso.icono, Search);
          if (!enLinea) {
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
          }
          return (
            <article className="paso" key={`${paso.titulo}-${i}`}>
              <span className="paso-numero" aria-hidden="true">
                {i + 1}
              </span>
              <span className="paso-icono" aria-hidden="true">
                <Icono size={26} strokeWidth={1.6} />
              </span>
              <div>
                <h3>{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
