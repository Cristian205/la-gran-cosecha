import type { Metadata } from "next";
import { IndiceCentroLegal } from "@/componentes/legal/CentroLegal";
import { configuracionDeLaTienda } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  return {
    title: "Centro legal",
    description: `Términos, políticas de datos, envíos, devoluciones, pagos y PQRS de ${config?.nombre_empresa ?? "la tienda"}.`,
    alternates: { canonical: "/legal" },
  };
}

export default function CentroLegal() {
  return <IndiceCentroLegal />;
}
