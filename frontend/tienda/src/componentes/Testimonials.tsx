"use client";

import { Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerTestimonios } from "@/lib/datos";
import type { Testimonio } from "@/lib/tipos";
import { Seccion, claseDeVariante } from "@/bloques/Seccion";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const VARIANTES = ["rejilla", "carrusel"] as const;

interface Props {
  kicker?: string;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
  variante?: string;
}

export function Testimonials({
  kicker = "Clientes",
  titulo = "Lo que dicen nuestros clientes",
  subtitulo,
  limite,
  variante,
}: Props) {
  const [testimonios, setTestimonios] = useState<Testimonio[]>([]);

  useEffect(() => {
    obtenerTestimonios()
      .then(setTestimonios)
      .catch(() => setTestimonios([]));
  }, []);

  const visibles = limite ? testimonios.slice(0, limite) : testimonios;
  if (visibles.length === 0) return null;

  return (
    <Seccion
      kicker={kicker}
      titulo={titulo}
      subtitulo={subtitulo}
      className="testimonios"
    >
      <div
        className={`testi-grid ${claseDeVariante(
          variante,
          VARIANTES,
          "testi-grid",
          "rejilla"
        )}`}
      >
        {visibles.map((t) => (
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
    </Seccion>
  );
}
