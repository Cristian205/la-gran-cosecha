"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SearchBar } from "@/componentes/tienda/SearchBar";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { claseDeVariante } from "./Seccion";

/**
 * El encabezado del catálogo (StoreHero): una franja funcional, no una
 * pantalla de publicidad.
 *
 * Quien llega a /tienda ya decidió comprar, así que este bloque no le vende
 * la marca otra vez —eso es el Inicio—: le confirma en menos de tres segundos
 * que está en el catálogo ("Todo para abastecer tu negocio", 190 productos, 7
 * categorías) y le pone delante la herramienta con la que va a empezar, el
 * buscador. La foto acompaña a un lado, sin tapar el texto ni competir con él.
 *
 * `mostrar_estadisticas` es un booleano y no un número fijo porque el dato lo
 * trae quien orquesta el catálogo (`CatalogoContexto`), no este bloque: un
 * encabezado no pide productos, cuenta los que ya pidió el catálogo. Cuenta el
 * catálogo ENTERO (`totalCatalogo`), no el filtro actual — elegir "Granos" no
 * puede hacer que el encabezado diga "12 productos".
 */
interface Props {
  kicker?: string;
  /** Compatibilidad: el antiguo ícono del antetítulo. Ya no se pinta. */
  kicker_icono?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  /** Composición fotográfica de producto. Decorativa: el texto al lado ya
   *  dice todo lo que hay que leer, por eso va con `alt` vacío. */
  imagen?: string;
  cta_texto?: string;
  cta_href?: string;
  variante?: string;
  mostrar_estadisticas?: boolean;
  /** Sin buscador el bloque vuelve a ser solo un encabezado. */
  mostrar_buscador?: boolean;
  buscador_etiqueta?: string;
  buscador_placeholder?: string;
}

const VARIANTES = ["compacto"] as const;

/** GIF transparente de 1×1: con él la foto no se descarga en móvil, donde el
 *  encabezado no la muestra. */
const PIXEL_VACIO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export function CatalogHero({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  imagen = "",
  cta_texto = "",
  cta_href = "#catalogo",
  variante,
  mostrar_estadisticas = true,
  mostrar_buscador = true,
  buscador_etiqueta = "¿Qué estás buscando?",
  buscador_placeholder = "Buscar productos…",
}: Props) {
  const catalogo = useCatalogoContexto();

  if (!titulo && !titulo_resaltado) return null;

  const clase = claseDeVariante(variante, VARIANTES, "catalogo-hero", "compacto");
  const total = catalogo?.totalCatalogo ?? null;
  const numCategorias = catalogo?.categorias.length ?? 0;
  const estadisticas =
    mostrar_estadisticas && catalogo && total !== null
      ? [
          { valor: total, etiqueta: total === 1 ? "producto" : "productos" },
          ...(numCategorias > 0
            ? [{ valor: numCategorias, etiqueta: numCategorias === 1 ? "categoría" : "categorías" }]
            : []),
        ]
      : [];

  return (
    <section className={`shero ${clase} ${imagen ? "" : "shero--sin-imagen"}`} aria-labelledby="shero-titulo">
      <div className="shero-inner">
        <div className="shero-texto">
          {kicker && <p className="shero-kicker">{kicker}</p>}

          <h1 id="shero-titulo">
            {titulo}
            {titulo_resaltado && (
              <>
                {titulo && " "}
                <em>{titulo_resaltado}</em>
              </>
            )}
          </h1>

          {texto && <p className="shero-bajada">{texto}</p>}

          {mostrar_buscador && catalogo && (
            <SearchBar etiqueta={buscador_etiqueta} placeholder={buscador_placeholder} />
          )}

          <div className="shero-pie">
            {estadisticas.length > 0 && (
              <p className="shero-stats">
                {estadisticas.map((e, i) => (
                  <span key={e.etiqueta}>
                    {i > 0 && (
                      <i aria-hidden="true" className="shero-sep">
                        ·
                      </i>
                    )}
                    <b>{e.valor}</b> {e.etiqueta}
                  </span>
                ))}
              </p>
            )}
            {cta_texto && (
              <Link className="shero-cta" href={cta_href || "#catalogo"}>
                {cta_texto} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {imagen && (
          <div className="shero-media" aria-hidden="true">
            <picture>
              <source media="(max-width: 767px)" srcSet={PIXEL_VACIO} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagen} alt="" width={1448} height={1086} decoding="async" fetchPriority="high" />
            </picture>
          </div>
        )}
      </div>
    </section>
  );
}
