import type { Metadata } from "next";
import { AboutPage } from "@/paginas/AboutPage";
import { configuracionDeLaTienda } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  return {
    title: "Nosotros",
    description:
      config?.historia?.slice(0, 160) ||
      `Conoce ${config?.nombre_empresa ?? "el negocio"} y cómo trabajamos.`,
    alternates: { canonical: "/nosotros" },
  };
}

export default function Nosotros() {
  return <AboutPage />;
}
