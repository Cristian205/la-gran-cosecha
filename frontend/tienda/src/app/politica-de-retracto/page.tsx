import type { Metadata } from "next";
import { PaginaPolitica } from "@/componentes/legal/CentroLegal";
import { metadatosDePolitica } from "@/lib/legal/servidor";

// Las páginas legales son todas iguales salvo el slug: el texto y los datos
// salen de `lib/legal` y de lo que el negocio diligencie en el panel.
const SLUG = "politica-de-retracto";

export function generateMetadata(): Promise<Metadata> {
  return metadatosDePolitica(SLUG);
}

export default function Pagina() {
  return <PaginaPolitica slug={SLUG} />;
}
