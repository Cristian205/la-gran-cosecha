import Link from "next/link";
import { ETIQUETAS, segmentar } from "@/lib/legal/datos";
import type { DatosLegales } from "@/lib/legal/tipos";

/**
 * Un texto legal con sus datos ya puestos.
 *
 * Lo que falta por diligenciar NO se esconde: se marca, para que el negocio
 * lo vea al revisar su sitio y para que nadie lea un párrafo al que le falta
 * la mitad sin darse cuenta. Ver `.legal-pendiente`.
 */
export function TextoLegal({ texto, datos }: { texto: string; datos: DatosLegales }) {
  return (
    <>
      {segmentar(texto, datos).map((s, i) => {
        if (s.tipo === "texto") return s.valor;
        if (s.tipo === "enlace") {
          return (
            <Link key={i} href={s.href} className="legal-enlace">
              {s.valor}
            </Link>
          );
        }
        if (s.valor) return <span key={i} className="legal-dato">{s.valor}</span>;
        return <Pendiente key={i} ruta={s.ruta} />;
      })}
    </>
  );
}

export function Pendiente({ ruta, etiqueta }: { ruta?: string; etiqueta?: string }) {
  const nombre = etiqueta ?? (ruta ? ETIQUETAS[ruta] ?? ruta : "Dato");
  return (
    <mark className="legal-pendiente" title="Dato por completar desde la administración de la tienda">
      [{nombre} por completar]
    </mark>
  );
}
