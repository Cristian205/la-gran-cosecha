import { Leaf, ShieldCheck, Truck, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerTrustBadges } from "../api/content";
import type { TrustBadge } from "../types";

const ICONOS: Record<TrustBadge["icono"], LucideIcon> = {
  leaf: Leaf,
  truck: Truck,
  users: Users,
  shield: ShieldCheck,
};

export function TrustBadges() {
  const [badges, setBadges] = useState<TrustBadge[]>([]);

  useEffect(() => {
    obtenerTrustBadges()
      .then(setBadges)
      .catch(() => setBadges([]));
  }, []);

  if (badges.length === 0) return null;

  return (
    <div className="trust-strip glass">
      {badges.map((b) => {
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
