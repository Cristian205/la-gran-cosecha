"use client";

import {
  BadgeCheck,
  Clock,
  Leaf,
  ShieldCheck,
  ShoppingBasket,
  Star,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type CSSProperties } from "react";
import { Boton, TipografiaEditorial, useHojaAsincrona, useSinMovimiento } from "../campanas/comunes";

const HOJA_PUBLICITARIA =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Playfair+Display:ital,wght@1,600;1,700&display=swap";
import { Medio, type MedioDatos } from "./Medio";

/**
 * El hero de /nosotros: una campaña, no una landing.
 *
 * La foto (o el video de la madrugada en el abasto, cuando exista) ocupa el
 * viewport entero y el titular se escribe encima, abajo a la izquierda, en
 * dos tiempos: "Mientras tú haces crecer tu negocio," — y, un instante
 * después, en serif cursiva, "nosotros conseguimos lo que necesitas." Es la
 * frase que la página entera va a demostrar.
 *
 * Al pie, el `recorrido`: la ruta que el cliente NO tiene que hacer
 * (madrugada → abasto → selección → tu negocio), con un punto que la recorre.
 * Es la primera pista de lo que cuenta el resto de la página.
 *
 * # Estilo «publicitario»
 *
 * Una pieza de anuncio sobre una foto con personas: el texto en una columna
 * a la izquierda, sobre un degradado verde que se disuelve hacia la foto, con
 * tres atributos de confianza (`atributos`) entre la descripción y los
 * botones. En móvil la composición se apila —texto arriba, foto abajo— para
 * que nada tape a las personas. En este estilo no se dibuja el `recorrido`.
 * El estilo de siempre (`clasico`) no cambia.
 *
 * El titular sale en el HTML del servidor y entra con CSS: si el JavaScript
 * tarda, el mensaje ya está. Solo el movimiento de cámara al hacer scroll
 * depende de Motion, y se apaga con `prefers-reduced-motion`.
 */
interface Atributo {
  texto?: string;
  /** `calidad`, `entrega`, `crecimiento`, `hoja`, `escudo`, `reloj`, `canasta`, `estrella`. */
  icono?: string;
}

interface Props extends MedioDatos {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  subtitulo?: string;
  recorrido?: string[];
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
  estilo?: "clasico" | "publicitario";
  atributos?: Atributo[];
}

const ICONOS_ATRIBUTO: Record<string, LucideIcon> = {
  calidad: BadgeCheck,
  entrega: Truck,
  crecimiento: TrendingUp,
  hoja: Leaf,
  escudo: ShieldCheck,
  reloj: Clock,
  canasta: ShoppingBasket,
  estrella: Star,
};

export function AboutHero({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  subtitulo = "",
  recorrido = [],
  cta_texto = "",
  cta_href = "#como-lo-hacemos",
  cta2_texto = "",
  cta2_href = "/tienda",
  estilo,
  atributos = [],
  ...medio
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const quieto = useSinMovimiento();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const escala = useTransform(scrollYProgress, [0, 1], [1.02, 1.18]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const textoY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const opacidad = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const publicitario = estilo === "publicitario";
  // Manrope (texto) y Playfair Display (frase destacada): solo este estilo las
  // necesita, así que se piden aparte y sin bloquear el pintado. Va antes del
  // `return` de abajo porque es un hook.
  useHojaAsincrona(publicitario ? HOJA_PUBLICITARIA : "");

  if (!titulo && !titulo_resaltado) return null;
  const pasos = publicitario ? [] : recorrido.filter(Boolean);
  const lista = (Array.isArray(atributos) ? atributos : []).filter((a) => a?.texto?.trim());

  return (
    <section
      ref={ref}
      className={`nh ${publicitario ? "nh--publicitario" : ""}`}
      aria-labelledby="nh-titulo"
    >
      <TipografiaEditorial />
      <motion.div className="nh-media" style={quieto ? undefined : { scale: escala, y }}>
        <Medio {...medio} prioridad className="nh-medio" />
      </motion.div>
      <div className="nh-velo" aria-hidden="true" />

      <motion.div className="nh-cuerpo" style={quieto ? undefined : { y: textoY, opacity: opacidad }}>
        {kicker && <p className="cmp-kicker nh-kicker nh-entra" style={{ "--i": 0 } as CSSProperties}>{kicker}</p>}
        <h1 id="nh-titulo" className="nh-titulo">
          {titulo && (
            <span className="nh-linea">
              <span className="nh-entra" style={{ "--i": 1 } as CSSProperties}>{titulo}</span>
            </span>
          )}
          {titulo_resaltado && (
            <span className="nh-linea">
              <em className="nh-entra" style={{ "--i": 2 } as CSSProperties}>{titulo_resaltado}</em>
            </span>
          )}
        </h1>
        {subtitulo && (
          <p className="nh-sub nh-entra" style={{ "--i": 3 } as CSSProperties}>
            {subtitulo}
          </p>
        )}
        {publicitario && lista.length > 0 && (
          <ul className="nh-atributos nh-entra" style={{ "--i": 4 } as CSSProperties}>
            {lista.map((a, i) => {
              const Icono = ICONOS_ATRIBUTO[a.icono ?? ""] ?? BadgeCheck;
              return (
                <li key={`${a.texto}-${i}`}>
                  <span className="nh-atributo-icono" aria-hidden="true">
                    <Icono size={18} strokeWidth={2} />
                  </span>
                  <span>{a.texto}</span>
                </li>
              );
            })}
          </ul>
        )}
        {(cta_texto || cta2_texto) && (
          <div className="nh-acciones nh-entra" style={{ "--i": publicitario ? 5 : 4 } as CSSProperties}>
            {cta_texto && <Boton href={cta_href || "#como-lo-hacemos"}>{cta_texto}</Boton>}
            {cta2_texto && (
              <Boton href={cta2_href || "/tienda"} variante="fantasma" flecha={false}>
                {cta2_texto}
              </Boton>
            )}
          </div>
        )}
      </motion.div>

      {pasos.length > 1 && (
        <ol className="nh-ruta" aria-label="El recorrido de tu pedido">
          {pasos.map((p, i) => (
            <li key={`${p}-${i}`} style={{ "--i": i } as CSSProperties}>
              <span>{p}</span>
            </li>
          ))}
          <span className="nh-ruta-punto" aria-hidden="true" style={{ "--pasos": pasos.length } as CSSProperties} />
        </ol>
      )}
    </section>
  );
}
