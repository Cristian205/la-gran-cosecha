import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Enlace } from "../contenido/tipos";
import { irA } from "../hooks/desplazamiento";
import { registrar } from "../lib/analitica";
import { elegirSolucion } from "../lib/solucion";

type Variante = "primario" | "secundario" | "oscuro" | "fantasma";

/**
 * El botón de la página. Un enlace, siempre: todos llevan a algún sitio y
 * todos miden su clic.
 *
 * Si el enlace expresa interés en una modalidad (`solucion`), además deja
 * elegida esa modalidad para el formulario del cierre. El primario sigue al
 * puntero unos pocos píxeles —lo justo para que se sienta vivo bajo la mano—;
 * con teclado o táctil no hay puntero que seguir y queda quieto.
 */
export function Boton({
  enlace,
  variante = "primario",
  icono = variante === "primario",
  children,
}: {
  enlace: Enlace;
  variante?: Variante;
  icono?: boolean;
  children?: ReactNode;
}) {
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const externo = /^https?:\/\//.test(enlace.href);

  function alMover(evento: MouseEvent<HTMLAnchorElement>) {
    if (variante !== "primario") return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set((evento.clientX - caja.left - caja.width / 2) * 0.16);
    y.set((evento.clientY - caja.top - caja.height / 2) * 0.24);
  }

  function alSalir() {
    x.set(0);
    y.set(0);
  }

  function alPulsar(evento: MouseEvent<HTMLAnchorElement>) {
    const origen = enlace.origen ?? "";
    registrar("cta_click", {
      etiqueta: enlace.etiqueta,
      destino: enlace.href,
      origen,
      solucion: enlace.solucion ?? "",
    });
    if (enlace.solucion) {
      elegirSolucion(enlace.solucion, origen);
      registrar("solucion_seleccionada", { solucion: enlace.solucion, origen });
    }
    if (!externo && irA(enlace.href)) evento.preventDefault();
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
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="boton__texto">{children ?? enlace.etiqueta}</span>
      {icono && <ArrowRight className="boton__icono" aria-hidden="true" />}
    </motion.a>
  );
}
