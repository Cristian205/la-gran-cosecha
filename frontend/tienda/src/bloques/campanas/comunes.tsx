"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";

/** Botón de las campañas: una sola forma para todo el Home, en tres tonos. */
export function Boton({
  href,
  children,
  variante = "ambar",
  flecha = true,
  onClick,
  disabled,
  icono,
}: {
  href?: string;
  children: ReactNode;
  variante?: "ambar" | "fantasma" | "oscuro";
  flecha?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Un icono antes del texto (el carrito de «Comprar ahora»). */
  icono?: ReactNode;
}) {
  const clase = `cmp-btn cmp-btn--${variante}`;
  const contenido = (
    <>
      {icono && <span className="cmp-btn-icono" aria-hidden="true">{icono}</span>}
      <span>{children}</span>
      {flecha && <ArrowRight size={17} aria-hidden="true" />}
    </>
  );
  if (!href) {
    return (
      <button type="button" className={clase} onClick={onClick} disabled={disabled}>
        {contenido}
      </button>
    );
  }
  if (/^https?:\/\//.test(href)) {
    return (
      <a className={clase} href={href} target="_blank" rel="noopener noreferrer">
        {contenido}
      </a>
    );
  }
  return (
    <Link className={clase} href={href}>
      {contenido}
    </Link>
  );
}

/**
 * La serif de los titulares con énfasis (Fraunces).
 *
 * Ya no pinta nada: la familia viaja en la MISMA hoja de Google Fonts que la
 * tipografía de la tienda (`fuenteDeGoogle`, en `lib/tema.ts`), que el layout
 * carga sin bloquear el pintado. Antes cada campaña subía su propio `<link>`
 * con `precedence`, que React trata como bloqueante: una petición más que
 * frenaba el primer pintado en el Home. Se conserva el componente para que las
 * 25 campañas que lo usan no cambien; si la fuente no llega,
 * `--fuente-editorial` cae a Georgia.
 */
export function TipografiaEditorial() {
  return null;
}

/**
 * Carga una hoja de Google Fonts SIN bloquear el pintado, una sola vez aunque
 * varios componentes la pidan. Se usa para fuentes que solo necesita un bloque
 * concreto (no merecen ir en la hoja global). El texto sale primero con la
 * fuente de respaldo y se cambia al llegar (`display=swap`).
 */
export function useHojaAsincrona(href: string) {
  useEffect(() => {
    if (!href || document.head.querySelector(`link[data-hoja="${href}"]`)) return;
    const hoja = document.createElement("link");
    hoja.rel = "stylesheet";
    hoja.href = href;
    hoja.dataset.hoja = href;
    document.head.appendChild(hoja);
  }, [href]);
}

/**
 * "Quiere menos movimiento", pero solo DESPUÉS de montar: el servidor no puede
 * saberlo, y si el primer render del cliente ya devolviera `true`, un bloque
 * que cambia de estructura por eso (BrandStory) no coincidiría con el HTML que
 * llegó y React rehidrataría entero con un error de hidratación.
 */
export function useSinMovimiento(): boolean {
  const pide = useReducedMotion();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado && Boolean(pide);
}

interface OpcionesParallax {
  desde?: number;
  hasta?: number;
  /** Desplazamiento vertical máximo, en % de la propia capa. */
  desplazamiento?: number;
  /** "hero" mide desde que el bloque toca el borde superior; "paso" mientras cruza la pantalla. */
  modo?: "hero" | "paso";
}

/**
 * El movimiento de cámara de una imagen: zoom lento y un desplazamiento
 * menor que el del scroll. Solo transform, nada que dispare layout. Para quien
 * pide menos movimiento devuelve un estilo vacío: la imagen se queda quieta.
 */
export function useParallax(
  ref: RefObject<HTMLElement | null>,
  { desde = 1.06, hasta = 1.2, desplazamiento = 9, modo = "paso" }: OpcionesParallax = {}
) {
  const quieto = useSinMovimiento();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: modo === "hero" ? ["start start", "end start"] : ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [desde, hasta]);
  const y = useTransform(scrollYProgress, [0, 1], [`-${desplazamiento}%`, `${desplazamiento}%`]);
  return quieto ? {} : { scale, y };
}
