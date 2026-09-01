"use client";

import { useEffect, useState } from "react";
import { obtenerTrustBadges } from "@/lib/datos";
import type { TrustBadge } from "@/lib/tipos";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

interface Props {
  /** Vacios por defecto: la franja de cifras se lee sola y un encabezado
   *  encima la convierte en una seccion mas. Quien lo quiera, lo pone. */
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
}

export function EstadisticasConfianza({ kicker, titulo, subtitulo, limite }: Props) {
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
      <div className="estadisticas-grid">
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
