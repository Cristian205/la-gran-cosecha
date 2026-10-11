"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Boton, TipografiaEditorial, useSinMovimiento } from "./comunes";

/**
 * «Cómo trabajamos»: el recorrido del producto, del campo a la puerta del
 * cliente, en cuatro escenas.
 *
 * Una sola pantalla —no un escenario que secuestra el scroll— con la foto a
 * sangre, el texto a la izquierda y los capítulos abajo. Los capítulos son
 * controles de verdad (pestañas): se eligen con el ratón, con el dedo
 * (deslizando), con las flechas del teclado o con los botones anterior y
 * siguiente, y al cambiar se mueven juntos la foto, el número, el antetítulo,
 * el titular, el texto y la barra de progreso.
 *
 * # Avance automático
 *
 * Discreto: cada `intervalo` segundos, SOLO mientras la sección está a la
 * vista, la pestaña del navegador está activa y el ratón no está encima. En
 * cuanto el visitante elige un capítulo, deja de
 * avanzar solo: ya está leyendo a su ritmo. Tiene su botón de pausa, y con
 * «reducir movimiento» no arranca nunca.
 *
 * # Fotos
 *
 * Todas las escenas están en el HTML desde el principio, apiladas, con su
 * propio texto alternativo; la activa y la siguiente se piden de inmediato y
 * el resto en diferido, así que al cambiar nunca hay un fondo vacío. Cada
 * capítulo admite una foto propia para móvil (vertical) y su encuadre.
 *
 * Un capítulo sin `imagen` no rompe nada: cae a un fondo verde de marca.
 */
export interface Capitulo {
  etiqueta?: string;
  titulo?: string;
  texto?: string;
  imagen?: string;
  imagen_movil?: string;
  alt?: string;
  enfoque?: string;
  enfoque_movil?: string;
}

interface Props {
  kicker?: string;
  capitulos?: Capitulo[];
  cta_texto?: string;
  cta_href?: string;
  /** Segundos por escena en el avance automático. 0 lo apaga. */
  intervalo?: number;
}

const DESLIZAR_PX = 50;

export function BrandStory({
  kicker = "",
  capitulos = [],
  cta_texto = "",
  cta_href = "/tienda",
  intervalo = 7,
}: Props) {
  const id = useId();
  const seccion = useRef<HTMLElement>(null);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const toque = useRef<number | null>(null);
  const quieto = useSinMovimiento();

  const lista = capitulos.filter((c) => c.titulo);
  const total = lista.length;

  const [activo, setActivo] = useState(0);
  const [visible, setVisible] = useState(false);
  const [encima, setEncima] = useState(false);
  // El visitante tomó el control (eligió un capítulo o pulsó pausa).
  const [manual, setManual] = useState(false);

  const segundos = Math.max(0, Number(intervalo) || 0);
  const avanzando = total > 1 && segundos > 0 && !quieto && !manual && visible && !encima;

  const ir = useCallback(
    (indice: number, porUsuario = true) => {
      if (total === 0) return;
      setActivo(((indice % total) + total) % total);
      if (porUsuario) setManual(true);
    },
    [total]
  );

  // Solo avanza mientras se ve: fuera de pantalla no tiene sentido gastar.
  useEffect(() => {
    const nodo = seccion.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.45 });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!avanzando) return;
    const reloj = window.setTimeout(() => {
      if (document.visibilityState === "visible") ir(activo + 1, false);
    }, segundos * 1000);
    return () => window.clearTimeout(reloj);
  }, [avanzando, activo, segundos, ir]);

  if (total === 0) return null;

  // Pestañas con el patrón de WAI-ARIA: flechas, Inicio y Fin.
  function conTeclado(e: KeyboardEvent<HTMLDivElement>) {
    const destino: Record<string, number> = {
      ArrowRight: activo + 1,
      ArrowLeft: activo - 1,
      Home: 0,
      End: total - 1,
    };
    if (!(e.key in destino)) return;
    e.preventDefault();
    const siguiente = ((destino[e.key] % total) + total) % total;
    ir(siguiente);
    pestanas.current[siguiente]?.focus();
  }

  const numero = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <section
      ref={seccion}
      className={`bs ${avanzando ? "bs--avanzando" : ""}`}
      style={{ "--bs-intervalo": `${segundos}s` } as CSSProperties}
      aria-roledescription="recorrido"
      aria-label={kicker || "Nuestra historia"}
      onPointerEnter={(e) => e.pointerType === "mouse" && setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onTouchStart={(e) => {
        toque.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const inicio = toque.current;
        toque.current = null;
        const fin = e.changedTouches[0]?.clientX;
        if (inicio === null || fin === undefined || Math.abs(fin - inicio) < DESLIZAR_PX) return;
        ir(fin < inicio ? activo + 1 : activo - 1);
      }}
    >
      <TipografiaEditorial />

      <div className="bs-fotos">
        {lista.map((c, i) => {
          const cerca = i === activo || i === (activo + 1) % total;
          return (
            <div
              key={`${c.titulo}-${i}`}
              className={`bs-foto ${i === activo ? "activa" : ""}`}
              aria-hidden={i !== activo}
              style={
                {
                  "--enfoque": c.enfoque || "50% 50%",
                  "--enfoque-movil": c.enfoque_movil || c.enfoque || "50% 50%",
                } as CSSProperties
              }
            >
              {c.imagen && (
                <picture>
                  {c.imagen_movil && <source media="(max-width: 780px)" srcSet={c.imagen_movil} />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.imagen}
                    alt={c.alt ?? ""}
                    width={1920}
                    height={1080}
                    loading={cerca ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : undefined}
                    decoding="async"
                  />
                </picture>
              )}
            </div>
          );
        })}
      </div>
      <div className="bs-velo" aria-hidden="true" />

      <div className="cmp-inner bs-marco">
        {kicker && <p className="cmp-kicker bs-kicker">{kicker}</p>}

        <div className="bs-capitulos" aria-live={avanzando ? "off" : "polite"}>
          {lista.map((c, i) => (
            <article
              key={`${c.titulo}-${i}`}
              id={`${id}-panel-${i}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${i}`}
              aria-hidden={i !== activo}
              className={`bs-capitulo ${i === activo ? "activo" : ""}`}
            >
              <span className="bs-numero" aria-hidden="true">
                {numero(i)}
              </span>
              {c.etiqueta && <p className="cmp-kicker">{c.etiqueta}</p>}
              <h2>{c.titulo}</h2>
              {c.texto && <p className="bs-parrafo">{c.texto}</p>}
              {cta_texto && i === total - 1 && (
                <div className="bs-cta">
                  <Boton href={cta_href || "/tienda"}>{cta_texto}</Boton>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="bs-controles">
          <div className="bs-progreso" role="tablist" aria-label="Etapas" onKeyDown={conTeclado}>
            {lista.map((c, i) => (
              <button
                key={`${c.etiqueta}-${i}`}
                ref={(nodo) => {
                  pestanas.current[i] = nodo;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${i}`}
                aria-selected={i === activo}
                aria-controls={`${id}-panel-${i}`}
                tabIndex={i === activo ? 0 : -1}
                className={i === activo ? "activo" : i < activo ? "hecho" : ""}
                onClick={() => ir(i)}
              >
                <i aria-hidden="true">
                  <b />
                </i>
                <span className="bs-progreso-numero">{numero(i)}</span>
                <span className="bs-progreso-texto">{c.etiqueta || `Etapa ${i + 1}`}</span>
              </button>
            ))}
          </div>

          {total > 1 && (
            <div className="bs-flechas">
              {segundos > 0 && !quieto && (
                <button
                  type="button"
                  className="bs-flecha bs-flecha--pausa"
                  onClick={() => setManual((m) => !m)}
                  aria-label={manual ? "Reanudar el recorrido automático" : "Pausar el recorrido automático"}
                  title={manual ? "Reanudar" : "Pausar"}
                >
                  {manual ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                </button>
              )}
              <button
                type="button"
                className="bs-flecha"
                onClick={() => ir(activo - 1)}
                aria-label="Etapa anterior"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="bs-flecha"
                onClick={() => ir(activo + 1)}
                aria-label="Etapa siguiente"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
