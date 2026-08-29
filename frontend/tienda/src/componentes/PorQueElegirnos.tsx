"use client";

import {
  CheckCircle2,
  Clock,
  Headphones,
  Package,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerBeneficios } from "@/lib/datos";
import type { BeneficioComercial } from "@/lib/tipos";

const ICONOS: Record<BeneficioComercial["icono"], LucideIcon> = {
  truck: Truck,
  clock: Clock,
  package: Package,
  wallet: Wallet,
  headset: Headphones,
  check: CheckCircle2,
  shield: ShieldCheck,
  users: Users,
};

export function PorQueElegirnos() {
  const [beneficios, setBeneficios] = useState<BeneficioComercial[]>([]);

  useEffect(() => {
    obtenerBeneficios()
      .then(setBeneficios)
      .catch(() => setBeneficios([]));
  }, []);

  if (beneficios.length === 0) return null;

  return (
    <section className="seccion">
      <div className="seccion-titulo">
        <div>
          <span className="seccion-kicker">Confianza</span>
          <h2>¿Por qué comprar con nosotros?</h2>
        </div>
      </div>
      <div className="valores-grid">
        {beneficios.map((b) => {
          const Icono = ICONOS[b.icono] ?? CheckCircle2;
          return (
            <article className="valor-card glass" key={b.id}>
              <span className="icono">
                <Icono size={24} />
              </span>
              <h3>{b.titulo}</h3>
              {b.texto && <p>{b.texto}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
