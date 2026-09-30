import type { Metadata } from "next";
import { MisPedidosPage } from "@/paginas/MisPedidosPage";

export const metadata: Metadata = {
  title: "Mis pedidos",
  // Es el historial de cada cliente: nada que indexar.
  robots: { index: false, follow: false },
};

export default function MisPedidos() {
  return <MisPedidosPage />;
}
