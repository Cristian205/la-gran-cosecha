import { Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerTestimonios } from "../api/content";
import type { Testimonio } from "../types";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Testimonials() {
  const [testimonios, setTestimonios] = useState<Testimonio[]>([]);

  useEffect(() => {
    obtenerTestimonios()
      .then(setTestimonios)
      .catch(() => setTestimonios([]));
  }, []);

  if (testimonios.length === 0) return null;

  return (
    <section className="testimonios">
      <div className="seccion-titulo">
        <h2>Lo que dicen nuestros clientes</h2>
      </div>
      <div className="testi-grid">
        {testimonios.map((t) => (
          <article className="testi-card glass" key={t.id}>
            <Quote className="quote-icon" size={26} />
            <div className="estrellas">
              {Array.from({ length: t.estrellas }).map((_, s) => (
                <Star key={s} size={15} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <p className="texto">"{t.texto}"</p>
            <div className="testi-autor">
              <span className="testi-avatar">{iniciales(t.nombre)}</span>
              <div>
                <div className="nombre">{t.nombre}</div>
                <div className="rol">{t.rol}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
