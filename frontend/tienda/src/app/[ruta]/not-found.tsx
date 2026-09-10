import Link from "next/link";
import { Lienzo } from "@/bloques/Lienzo";
import { composicionDe, datosDeLosBloques, RUTA_NO_ENCONTRADA } from "@/lib/pagina";

/**
 * Una ruta que no corresponde a ninguna página de ESTE negocio.
 *
 * Distinto del `not-found.tsx` de la raíz: aquel es "esta tienda no existe"
 * (ningún negocio resuelve ese dominio); este es "esta tienda existe, pero
 * esta página no" — el negocio tiene una tienda real, así que sí puede
 * llevar su marca. `app/[ruta]/page.tsx` es quien dispara este límite al
 * llamar `notFound()` cuando la ruta pedida no tiene composición.
 *
 * Si el negocio compuso `/_no-encontrada` desde el panel, se pinta esa
 * composición tal cual —es una página más, con sus bloques y su editor—. Si
 * no la ha tocado (la mayoría de las tiendas creadas antes de que esto
 * existiera), cae a un mensaje genérico que nunca deja al visitante sin nada.
 */
export default async function RutaNoEncontrada() {
  const pagina = await composicionDe(RUTA_NO_ENCONTRADA);

  if (pagina && pagina.bloques.length > 0) {
    const datos = await datosDeLosBloques(pagina);
    return <Lienzo bloques={pagina.bloques} datos={datos} />;
  }

  return (
    <main className="pagina-vacia">
      <h1>Esta página no existe</h1>
      <p>
        La dirección a la que llegaste no corresponde a ninguna página de esta
        tienda. Puede que se haya movido o que el enlace esté desactualizado.
      </p>
      <Link className="btn btn-verde" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
