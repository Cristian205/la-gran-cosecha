import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerBanners } from "../api/content";
import type { PromoBanner } from "../types";

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

export function PromoCarousel() {
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
    if (total <= 1) return;
    const id = setInterval(siguiente, INTERVALO_MS);
    return () => clearInterval(id);
  }, [siguiente, total]);

  const slide = slides[indice] ?? SLIDE_RESPALDO;
  const esExterno = slide.cta_href.startsWith("http");

  return (
    <section className="hero-carrusel">
      {slide.imagen_url && (
        <div className="slide-bg">
          <img src={slide.imagen_url} alt="" />
        </div>
      )}
      <span className="blob b1" />
      <span className="blob b2" />

      <div className="slide-track">
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
                <Link className="btn btn-ambar" to={slide.cta_href || "/tienda"}>
                  {slide.cta_texto}
                </Link>
              ))}
            <Link className="btn btn-fantasma" to="/tienda">
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
