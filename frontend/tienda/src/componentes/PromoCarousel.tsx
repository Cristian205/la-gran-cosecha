"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { obtenerBanners } from "@/lib/datos";
import type { PromoBanner } from "@/lib/tipos";
import { claseDeVariante } from "@/bloques/Seccion";

const INTERVALO_MS = 6000;

const SLIDE_RESPALDO: PromoBanner = {
  id: 0,
  imagen_url: null,
  etiqueta: "🌱 Directo del campo",
  titulo: "Productos frescos, todos los días en tu negocio",
  texto: "Frutas, verduras y granos seleccionados a mano. Arma tu pedido en minutos.",
  cta_texto: "Ver tienda",
  cta_href: "/tienda",
  orden: 0,
};

const VARIANTES = ["completo", "contenido"] as const;

interface Props {
  /** Rotar solo. Apagarlo deja el control al visitante, que es lo que piden
   *  las tiendas con una sola banderola importante. */
  autoplay?: boolean;
  /** Segundos por banderola. Se acota para que nadie deje 0 y se dispare. */
  segundos?: number;
  variante?: string;
}

export function PromoCarousel({ autoplay = true, segundos, variante }: Props) {
  const [slides, setSlides] = useState<PromoBanner[]>([SLIDE_RESPALDO]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    obtenerBanners()
      .then((data) => {
        if (data.length > 0) setSlides(data);
      })
      .catch(() => {
        /* se mantiene el slide de respaldo */
      });
  }, []);

  const total = slides.length;

  const siguiente = useCallback(() => {
    setIndice((i) => (i + 1) % total);
  }, [total]);

  const anterior = () => {
    setIndice((i) => (i - 1 + total) % total);
  };

  useEffect(() => {
    setIndice(0);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || !autoplay) return;
    // Un valor fuera de rango no puede convertir el carrusel en un parpadeo ni
    // en algo que no rota: el constructor acepta el numero, esto lo acota.
    const espera = Math.min(30, Math.max(2, segundos ?? INTERVALO_MS / 1000)) * 1000;
    const id = setInterval(siguiente, espera);
    return () => clearInterval(id);
  }, [siguiente, total, autoplay, segundos]);

  const slide = slides[indice] ?? SLIDE_RESPALDO;
  const esExterno = slide.cta_href.startsWith("http");

  return (
    <section
      className={`hero-carrusel ${claseDeVariante(
        variante,
        VARIANTES,
        "hero-carrusel",
        "completo"
      )}`}
    >
      {slide.imagen_url && (
        <div className="slide-bg">
          <img src={slide.imagen_url} alt="" />
        </div>
      )}
      <span className="blob b1" />
      <span className="blob b2" />

      <div className="slide-track contenedor">
        <div className="slide-contenido">
          {slide.etiqueta && <span className="slide-tag glass-dark">{slide.etiqueta}</span>}
          <h1>{slide.titulo}</h1>
          <p>{slide.texto}</p>
          <div className="slide-acciones">
            {slide.cta_texto &&
              (esExterno ? (
                <a
                  className="btn btn-ambar"
                  href={slide.cta_href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {slide.cta_texto}
                </a>
              ) : (
                <Link className="btn btn-ambar" href={slide.cta_href || "/tienda"}>
                  {slide.cta_texto}
                </Link>
              ))}
            <Link className="btn btn-fantasma" href="/tienda">
              <ShoppingBag size={16} />
              Ir a la tienda
            </Link>
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="carrusel-controles">
          <button className="carrusel-flecha" onClick={anterior} aria-label="Promoción anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="carrusel-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                className={i === indice ? "activo" : ""}
                onClick={() => setIndice(i)}
                aria-label={`Ir a la promoción ${i + 1}`}
              />
            ))}
          </div>
          <button className="carrusel-flecha" onClick={siguiente} aria-label="Siguiente promoción">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
