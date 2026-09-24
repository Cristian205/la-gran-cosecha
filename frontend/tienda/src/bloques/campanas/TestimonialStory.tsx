"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/componentes/animacion";
import { desempaquetar, obtenerTestimonios } from "@/lib/datos";
import type { Paginated, Testimonio } from "@/lib/tipos";
import { TipografiaEditorial } from "./comunes";

/**
 * Testimonios como voces de la marca, no como reseñas.
 *
 * Cada uno ocupa un panel grande con la cita en serif cursiva; el negocio
 * (`rol`, donde el panel guarda "Menta", "La Cima"...) va como firma. Sin
 * estrellas: todas las reseñas reales son de cinco y repetirlas cinco veces
 * dice menos que la propia frase. No hay fotos ni logos cargados todavía, así
 * que la firma es tipográfica; cuando existan entrarán aquí.
 *
 * Es una pista con scroll horizontal —deslizar en móvil, flechas y teclado en
 * escritorio— que se ajusta a cada panel. Los datos llegan del servidor, así
 * que las citas están en el HTML para el buscador.
 */
interface Props {
  datos?: Paginated<Testimonio> | Testimonio[];
  kicker?: string;
  titulo?: string;
}

export function TestimonialStory({
  datos,
  kicker = "Negocios que confían en nosotros",
  titulo = "",
}: Props) {
  const [lista, setLista] = useState<Testimonio[]>(datos ? desempaquetar(datos) : []);
  const pista = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (lista.length > 0) return;
    obtenerTestimonios()
      .then(setLista)
      .catch(() => setLista([]));
  }, [lista.length]);

  const actualizar = useCallback(() => {
    const el = pista.current;
    if (!el || el.children.length === 0) return;
    const ancho = (el.children[0] as HTMLElement).offsetWidth + 24;
    setIndice(Math.round(el.scrollLeft / ancho));
  }, []);

  function ir(delta: number) {
    const el = pista.current;
    if (!el || el.children.length === 0) return;
    const ancho = (el.children[0] as HTMLElement).offsetWidth + 24;
    el.scrollBy({ left: delta * ancho, behavior: "smooth" });
  }

  if (lista.length === 0) return null;

  return (
    <section className="ts">
      <TipografiaEditorial />
      <div className="cmp-inner">
        <Reveal className="ts-cabecera">
          <div>
            <p className="cmp-kicker">{kicker}</p>
            {titulo && <h2>{titulo}</h2>}
          </div>
          {lista.length > 1 && (
            <div className="ts-mandos">
              <span aria-hidden="true">
                {String(Math.min(indice + 1, lista.length)).padStart(2, "0")} / {String(lista.length).padStart(2, "0")}
              </span>
              <button type="button" onClick={() => ir(-1)} aria-label="Testimonio anterior">
                <ArrowLeft size={18} />
              </button>
              <button type="button" onClick={() => ir(1)} aria-label="Siguiente testimonio">
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </Reveal>
      </div>

      <div
        className="ts-pista"
        ref={pista}
        onScroll={actualizar}
        role="region"
        aria-label="Testimonios de clientes"
        tabIndex={0}
      >
        {lista.map((t) => (
          <figure className="ts-panel" key={t.id}>
            <blockquote>
              <p>{t.texto}</p>
            </blockquote>
            <figcaption>
              <strong>{t.nombre}</strong>
              {t.rol && <span>{t.rol}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
