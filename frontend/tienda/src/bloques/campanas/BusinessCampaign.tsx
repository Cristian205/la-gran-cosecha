"use client";

import { Reveal } from "@/componentes/animacion";
import type { Paginated, Producto } from "@/lib/tipos";
import { Boton, TipografiaEditorial } from "./comunes";

/**
 * La pieza para negocios: restaurantes, hoteles, cafeterías, fruterías y
 * tiendas. Es publicidad B2B —un titular grande, una imagen del abastecimiento
 * y cuatro líneas de texto—, no una rejilla de "públicos".
 *
 * El único número que muestra es el tamaño real del catálogo, que llega del
 * servidor (`count` de `/catalog/products/`): si no llega, la línea no existe.
 * Nada de cifras escritas a mano.
 *
 * Tiene ancla (`#negocios`) porque el menú "Para negocios" apunta aquí.
 */
export interface Segmento {
  titulo?: string;
  texto?: string;
}

interface Props {
  datos?: Paginated<Producto> | Producto[];
  ancla?: string;
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  segmentos?: Segmento[];
  imagen?: string;
  imagen_alt?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
}

export function BusinessCampaign({
  datos,
  ancla = "negocios",
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  segmentos = [],
  imagen = "",
  imagen_alt = "",
  cta_texto = "",
  cta_href = "/contacto",
  cta2_texto = "",
  cta2_href = "/tienda",
}: Props) {
  if (!titulo) return null;

  const totalCatalogo =
    datos && !Array.isArray(datos) && typeof datos.count === "number" ? datos.count : null;

  return (
    <section id={ancla || undefined} className="bn">
      <TipografiaEditorial />
      <div className="cmp-inner bn-grid">
        <div className="bn-texto">
          <Reveal>
            {kicker && <p className="cmp-kicker">{kicker}</p>}
            <h2>
              {titulo}
              {titulo_resaltado && <em>{titulo_resaltado}</em>}
            </h2>
          </Reveal>
          {texto && (
            <Reveal retraso={0.1}>
              <p className="bn-parrafo">{texto}</p>
            </Reveal>
          )}

          {segmentos.length > 0 && (
            <Reveal retraso={0.18}>
              <ul className="bn-segmentos">
                {segmentos.map((s, i) => (
                  <li key={`${s.titulo}-${i}`}>
                    <strong>{s.titulo}</strong>
                    {s.texto && <span>{s.texto}</span>}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal retraso={0.26} className="bn-acciones">
            {cta_texto && <Boton href={cta_href || "/contacto"}>{cta_texto}</Boton>}
            {cta2_texto && (
              <Boton href={cta2_href || "/tienda"} variante="fantasma" flecha={false}>
                {cta2_texto}
              </Boton>
            )}
          </Reveal>
          {totalCatalogo !== null && totalCatalogo > 0 && (
            <p className="bn-dato">
              <strong>{totalCatalogo}</strong> productos, un solo pedido.
            </p>
          )}
        </div>

        {imagen && (
          <Reveal className="bn-imagen" retraso={0.1}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen} alt={imagen_alt} loading="lazy" decoding="async" />
          </Reveal>
        )}
      </div>
    </section>
  );
}
