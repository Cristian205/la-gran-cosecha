"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/componentes/animacion";
import { desempaquetar, obtenerTestimonios } from "@/lib/datos";
import type { Paginated, Testimonio } from "@/lib/tipos";
import { TipografiaEditorial } from "./comunes";

/**
 * Testimonios como voces de la marca, no como reseñas.
 *
 * Tarjetas blancas compactas: comillas discretas, la cita alineada a la
 * izquierda y, separada por un filete, la firma — un avatar con las iniciales
 * del cliente (o su foto, si la tiene), su nombre y su negocio (`rol`, donde
 * el panel guarda "Menta", "La Cima"...). Sin estrellas: todas las reseñas
 * reales son de cinco y repetirlas dice menos que la propia frase.
 *
 * Es una pista con scroll horizontal y ajuste por tarjeta: se desliza con el
 * dedo en pantallas táctiles y con las flechas (o el teclado) con ratón.
 * Cuántas tarjetas caben lo decide el CSS según el ancho (dos y media en
 * escritorio, una completa en el teléfono). El contador y la línea de
 * progreso siguen la posición real del scroll. Los datos llegan del servidor,
 * así que las citas están en el HTML para el buscador.
 */
interface Props {
  datos?: Paginated<Testimonio> | Testimonio[];
  kicker?: string;
  titulo?: string;
}

/** «Sofia Melendez» → «SM». Solo letras del nombre real; nada inventado. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  return letras.map((p) => p[0]?.toLocaleUpperCase("es") ?? "").join("");
}

export function TestimonialStory({
  datos,
  kicker = "Negocios que confían en nosotros",
  titulo = "Negocios que crecen con nosotros",
}: Props) {
  const [lista, setLista] = useState<Testimonio[]>(datos ? desempaquetar(datos) : []);
  const pista = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(false);

  useEffect(() => {
    if (lista.length > 0) return;
    obtenerTestimonios()
      .then(setLista)
      .catch(() => setLista([]));
  }, [lista.length]);

  /** Ancho de un paso: una tarjeta más el hueco real de la pista (el CSS lo
   *  cambia según el ancho de pantalla, así que se lee, no se supone). */
  const paso = useCallback(() => {
    const el = pista.current;
    if (!el || el.children.length === 0) return 0;
    const hueco = parseFloat(getComputedStyle(el).columnGap) || 0;
    return (el.children[0] as HTMLElement).offsetWidth + hueco;
  }, []);

  const actualizar = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const ancho = paso();
    if (!ancho) return;
    const max = el.scrollWidth - el.clientWidth;
    const final = el.scrollLeft >= max - 2;
    setAlInicio(el.scrollLeft <= 2);
    setAlFinal(final);
    // Con varias tarjetas a la vista la última nunca llega al borde
    // izquierdo: al llegar al final, la posición es la última.
    setIndice(final ? el.children.length - 1 : Math.round(el.scrollLeft / ancho));
  }, [paso]);

  useEffect(() => {
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, [actualizar, lista.length]);

  function ir(delta: number) {
    const el = pista.current;
    const ancho = paso();
    if (!el || !ancho) return;
    el.scrollBy({ left: delta * ancho, behavior: "smooth" });
  }

  if (lista.length === 0) return null;

  const total = lista.length;
  const actual = Math.min(indice + 1, total);
  const dos = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="ts">
      <TipografiaEditorial />
      <div className="cmp-inner">
        <Reveal className="ts-cabecera">
          <div className="ts-titulos">
            <p className="cmp-kicker">{kicker}</p>
            {titulo && <h2>{titulo}</h2>}
          </div>
          {total > 1 && (
            <div className="ts-mandos">
              <span className="ts-contador" aria-hidden="true">
                <b>{dos(actual)}</b> / {dos(total)}
              </span>
              <span className="ts-progreso" aria-hidden="true">
                <i style={{ "--ts-avance": actual / total } as CSSProperties} />
              </span>
              <div className="ts-flechas">
                <button type="button" onClick={() => ir(-1)} disabled={alInicio} aria-label="Testimonio anterior">
                  <ArrowLeft size={17} />
                </button>
                <button type="button" onClick={() => ir(1)} disabled={alFinal} aria-label="Siguiente testimonio">
                  <ArrowRight size={17} />
                </button>
              </div>
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
        {lista.map((t, i) => (
          <figure className={`ts-panel ${i === indice ? "activo" : ""}`} key={t.id}>
            <blockquote>
              <p>{t.texto}</p>
            </blockquote>
            <figcaption>
              {t.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ts-avatar" src={t.foto_url} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="ts-avatar" aria-hidden="true">
                  {iniciales(t.nombre)}
                </span>
              )}
              <span className="ts-firma">
                <strong>{t.nombre}</strong>
                {t.rol && <span>{t.rol}</span>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
