import type { Metadata } from "next";
import { ContactPage } from "@/paginas/ContactPage";
import { configuracionDeLaTienda } from "@/lib/negocio";

export async function generateMetadata(): Promise<Metadata> {
  const config = await configuracionDeLaTienda();
  return {
    title: "Contacto",
    description: `Escríbenos o llámanos: ${
      config?.telefono || config?.email || config?.nombre_empresa || ""
    }`.trim(),
    alternates: { canonical: "/contacto" },
  };
}

export default function Contacto() {
  return <ContactPage />;
}
