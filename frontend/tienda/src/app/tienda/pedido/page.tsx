import type { Metadata } from "next";
import { CheckoutPage } from "@/paginas/CheckoutPage";

export const metadata: Metadata = {
  title: "Tu pedido",
  // El carrito es privado de cada visitante y no aporta nada indexado; peor
  // aún, competiría con el catálogo por la misma intención de búsqueda.
  robots: { index: false, follow: true },
};

export default function Pedido() {
  return <CheckoutPage />;
}
