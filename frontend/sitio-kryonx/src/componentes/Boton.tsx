import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Enlace } from "../contenido/tipos";
import { irA } from "../hooks/desplazamiento";

/**
 * El botón de la página. Un enlace, siempre: todos llevan a algún sitio.
 *
 * El primario sigue al puntero unos pocos píxeles —lo justo para que se
 * sienta vivo bajo la mano— y lleva un brillo que lo cruza al pasar. Con el
 * teclado o en táctil no hay puntero que seguir y queda quieto, que es lo
 * correcto.
 */
export function Boton({
  enlace,
  variante = "primario",
  icono = variante === "primario",
  children,
}: {
  enlace: Enlace;
  variante?: "primario" | "secundario" | "fantasma";
  icono?: boolean;
  children?: ReactNode;
}) {
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });

  function alMover(evento: MouseEvent<HTMLAnchorElement>) {
    if (variante !== "primario") return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set((evento.clientX - caja.left - caja.width / 2) * 0.18);
    y.set((evento.clientY - caja.top - caja.height / 2) * 0.28);
  }

  function alSalir() {
    x.set(0);
    y.set(0);
  }

  function alPulsar(evento: MouseEvent<HTMLAnchorElement>) {
    if (irA(enlace.href)) evento.preventDefault();
  }

  return (
    <motion.a
      href={enlace.href}
      className={`boton boton--${variante}`}
      style={{ x, y }}
      onMouseMove={alMover}
      onMouseLeave={alSalir}
      onClick={alPulsar}
      whileTap={{ scale: 0.97 }}
    >
      <span className="boton__texto">{children ?? enlace.etiqueta}</span>
      {icono && <ArrowRight className="boton__icono" aria-hidden="true" />}
    </motion.a>
  );
}
