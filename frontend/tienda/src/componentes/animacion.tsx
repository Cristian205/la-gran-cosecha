"use client";

import { motion, type HTMLMotionProps, type Transition, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Reemplaza `.revelar` (CSS puro con `animation-timeline: view()`, que solo
 * corre en navegadores Chromium) por una entrada animada con Motion: sube y
 * aparece al entrar en pantalla, una sola vez, en cualquier navegador.
 *
 * `MotionConfig reducedMotion="user"` (puesto en `CapaCliente`) es quien
 * decide por quien pide menos movimiento — este componente no repite esa
 * comprobación.
 */
const ENTRADA: Variants = {
  oculto: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const TRANSICION: Transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] };

const ETIQUETAS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  nav: motion.nav,
} as const;

type Etiqueta = keyof typeof ETIQUETAS;

interface RevealProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "whileInView" | "viewport"> {
  as?: Etiqueta;
  /** Retraso en segundos, para escalonar tarjetas dentro de un mismo `.map()`
   *  sin depender de un contenedor común con `staggerChildren`. */
  retraso?: number;
  children: ReactNode;
}

export function Reveal({ as = "div", retraso = 0, transition, children, ...resto }: RevealProps) {
  const Componente = ETIQUETAS[as];
  return (
    <Componente
      variants={ENTRADA}
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...TRANSICION, delay: retraso, ...transition }}
      {...resto}
    >
      {children}
    </Componente>
  );
}
