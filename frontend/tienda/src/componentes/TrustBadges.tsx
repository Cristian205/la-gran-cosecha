"use client";

import { Leaf, ShieldCheck, Truck, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerTrustBadges } from "@/lib/datos";
import type { TrustBadge } from "@/lib/tipos";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

const ICONOS: Record<TrustBadge["icono"], LucideIcon> = {
  leaf: Leaf,
  truck: Truck,
  users: Users,
  shield: ShieldCheck,
};

const VARIANTES = ["franja", "tarjetas"] as const;

interface Props {
  limite?: number;
  variante?: string;
}

/**
 * No usa `Seccion`: es una franja, no una seccion con encabezado. Meterle un
 * `h2` la convertiria en otra cosa.
 */
export function TrustBadges({ limite, variante }: Props) {
  const [badges, setBadges] = useState<TrustBadge[]>([]);

  useEffect(() => {
    obtenerTrustBadges()
      .then((data) => setBadges(data.filter((b) => b.tipo === "insignia")))
      .catch(() => setBadges([]));
  }, []);

  const visibles = limite ? badges.slice(0, limite) : badges;
  if (visibles.length === 0) return null;

  return (
    <div
      className={`trust-strip glass ${claseDeVariante(
        variante,
        VARIANTES,
        "trust-strip",
        "franja"
      )}`}
    >
      {visibles.map((b) => {
        const Icono = ICONOS[b.icono];
        return (
          <div className="trust-item" key={b.id}>
            <span className="icono">
              <Icono size={22} />
            </span>
            <div>
              <div className="valor">{b.valor}</div>
              <div className="etiqueta">{b.etiqueta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
