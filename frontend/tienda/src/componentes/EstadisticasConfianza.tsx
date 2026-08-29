"use client";

import { useEffect, useState } from "react";
import { obtenerTrustBadges } from "@/lib/datos";
import type { TrustBadge } from "@/lib/tipos";

export function EstadisticasConfianza() {
  const [stats, setStats] = useState<TrustBadge[]>([]);

  useEffect(() => {
    obtenerTrustBadges()
      .then((data) => setStats(data.filter((b) => b.tipo === "estadistica")))
      .catch(() => setStats([]));
  }, []);

  if (stats.length === 0) return null;

  return (
    <section className="seccion">
      <div className="estadisticas-grid">
        {stats.map((s) => (
          <div className="estadistica-tile" key={s.id}>
            <span className="estadistica-valor">{s.valor}</span>
            <span className="estadistica-etiqueta">{s.etiqueta}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
