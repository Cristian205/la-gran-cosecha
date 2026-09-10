"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";

/**
 * El hero del catálogo: una franja, no una pantalla completa.
 *
 * Es la versión reducida del hero del Inicio (`Portada`) — quien llega aquí ya
 * decidió entrar a comprar, así que el bloque no tiene que volver a venderle
 * la propuesta, solo confirmarle dónde está y dejarle ver productos cuanto
 * antes. Por eso es un bloque APARTE y no una variante de `Portada`: sus
 * variantes van a divergir (esta nunca va a tener tarjeta flotante ni
 * ventajas en lista), y forzarlas al mismo componente las ataría para
 * siempre a la misma maqueta.
 *
 * `mostrar_estadisticas` es un booleano y no un número fijo porque el dato
 * —cuántos productos, cuántas categorías— lo trae quien orqueste el catálogo
 * (`grid-productos`/`categorias-navegacion` vía `CatalogoContexto`), no este
 * bloque: un hero no pide productos, los cuenta el que ya los pidió.
 */
interface Props {
  kicker?: string;
  kicker_icono?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  /** Fondo decorativo, con velo de marca encima (por eso no lleva `alt`: el
   *  texto que la cubre ya dice todo lo que hay que leer). */
  imagen?: string;
  cta_texto?: string;
  cta_href?: string;
  variante?: string;
  /** Cuántos productos y categorías hay, en vivo. Se apaga solo si no hay
   *  ningún `CatalogoProvider` alrededor: un hero no pide productos, cuenta
   *  los que ya pidió quien orquesta el catálogo. */
  mostrar_estadisticas?: boolean;
}

const VARIANTES = ["compacto"] as const;

export function CatalogHero({
  kicker = "",
  kicker_icono = "canasta",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  imagen = "",
  cta_texto = "",
  cta_href = "#catalogo",
  variante,
  mostrar_estadisticas = true,
}: Props) {
  const catalogo = useCatalogoContexto();

  if (!titulo && !titulo_resaltado) return null;

  const IconoKicker = icono(kicker_icono);
  const clase = claseDeVariante(variante, VARIANTES, "catalogo-hero", "compacto");
  const estadisticas =
    mostrar_estadisticas && catalogo && catalogo.total !== null
      ? [
          { valor: catalogo.total, etiqueta: catalogo.total === 1 ? "producto" : "productos" },
          {
            valor: catalogo.categorias.length,
            etiqueta: catalogo.categorias.length === 1 ? "categoría" : "categorías",
          },
        ]
      : [];

  return (
    <section className={`catalogo-hero ${clase} ${imagen ? "" : "catalogo-hero--sin-imagen"}`}>
      {imagen && (
        <img
          className="catalogo-hero-fondo"
          src={imagen}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      )}

      <div className="catalogo-hero-cuerpo">
        {kicker && (
          <span className="catalogo-hero-kicker glass-dark">
            <IconoKicker size={15} aria-hidden="true" />
            {kicker}
          </span>
        )}

        <h1>
          {titulo}
          {titulo_resaltado && (
            <>
              {titulo && " "}
              <em>{titulo_resaltado}</em>
            </>
          )}
        </h1>

        {texto && <p className="catalogo-hero-texto">{texto}</p>}

        {cta_texto && (
          <Link className="btn btn-ambar" href={cta_href || "#catalogo"}>
            {cta_texto} <ArrowRight size={17} />
          </Link>
        )}

        {estadisticas.length > 0 && (
          <p className="catalogo-hero-stat">
            {estadisticas.map((e, i) => (
              <span key={e.etiqueta}>
                {i > 0 && <i aria-hidden="true">·</i>}
                <b>{e.valor}</b> {e.etiqueta}
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}
