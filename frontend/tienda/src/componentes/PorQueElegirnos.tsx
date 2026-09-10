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
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

/**
 * `rejilla` da a cada beneficio su tarjeta; `lista` los pone en una columna con
 * el icono al lado del texto. La rejilla luce con cuatro o seis y se desarma
 * con dos; la lista aguanta cualquier numero y ocupa la mitad de alto, que es
 * lo que pide un pagina larga donde esto no es el argumento principal.
 *
 * El componente ya importaba `claseDeVariante` sin usarlo: declaraba cero
 * variantes en el catalogo y pintaba siempre lo mismo.
 */
const VARIANTES = ["rejilla", "lista"] as const;

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

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
  variante?: string;
}

export function PorQueElegirnos({
  kicker = "Confianza",
  titulo = "¿Por qué comprar con nosotros?",
  subtitulo,
  limite,
  variante,
}: Props) {
  const [beneficios, setBeneficios] = useState<BeneficioComercial[]>([]);

  useEffect(() => {
    obtenerBeneficios()
      .then(setBeneficios)
      .catch(() => setBeneficios([]));
  }, []);

  const visibles = limite ? beneficios.slice(0, limite) : beneficios;
  if (visibles.length === 0) return null;

  return (
    <Seccion kicker={kicker} titulo={titulo} subtitulo={subtitulo}>
      <div className={`valores-grid ${claseDeVariante(variante, VARIANTES, "valores", "rejilla")}`}>
        {visibles.map((b) => {
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
    </Seccion>
  );
}
