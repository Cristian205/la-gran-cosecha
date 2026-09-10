"use client";

import { useEffect, useState } from "react";
import { obtenerTrustBadges } from "@/lib/datos";
import type { TrustBadge } from "@/lib/tipos";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

/**
 * `franja` pone las cifras seguidas y separadas por una linea; `tarjetas` le da
 * a cada una su caja. La primera pesa menos y cabe encima del pliegue; la
 * segunda aguanta mejor cuando las cifras son largas o son solo dos.
 *
 * El componente importaba `claseDeVariante` y no lo usaba: declaraba cero
 * variantes en el catalogo y pintaba siempre lo mismo.
 */
const VARIANTES = ["franja", "tarjetas"] as const;

interface Props {
  /** Vacios por defecto: la franja de cifras se lee sola y un encabezado
   *  encima la convierte en una seccion mas. Quien lo quiera, lo pone. */
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
  variante?: string;
}

export function EstadisticasConfianza({ kicker, titulo, subtitulo, limite, variante }: Props) {
  const [stats, setStats] = useState<TrustBadge[]>([]);

  useEffect(() => {
    obtenerTrustBadges()
      .then((data) => setStats(data.filter((b) => b.tipo === "estadistica")))
      .catch(() => setStats([]));
  }, []);

  const visibles = limite ? stats.slice(0, limite) : stats;
  if (visibles.length === 0) return null;

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div className={`estadisticas-grid ${claseDeVariante(variante, VARIANTES, "estadisticas", "franja")}`}>
        {visibles.map((s) => (
          <div className="estadistica-tile" key={s.id}>
            <span className="estadistica-valor">{s.valor}</span>
            <span className="estadistica-etiqueta">{s.etiqueta}</span>
          </div>
        ))}
      </div>
    </Seccion>
  );
}
