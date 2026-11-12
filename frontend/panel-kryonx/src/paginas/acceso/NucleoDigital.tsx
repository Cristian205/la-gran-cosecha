import { motion, MotionConfig, useMotionValue, useSpring, useTransform } from "motion/react";
import type { CSSProperties, PointerEvent } from "react";
import isotipo from "../../assets/crafteech-isotipo.webp";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * El núcleo: el isotipo oficial de Crafteech con órbitas, nodos y piezas
 * flotantes alrededor. Es una composición CSS 3D (transformaciones, no WebGL):
 * cuesta unos pocos KB y ningún contexto de GPU, y el movimiento perpetuo vive
 * en animaciones CSS de `transform` —compuestas por la GPU—.
 *
 * Motion pone lo que depende de la persona y del momento: la entrada escalonada
 * y la inclinación suave con el puntero. Con «reducir movimiento» no hay
 * entrada, ni inclinación, ni giro: queda la imagen fija y completa.
 *
 * Es decorativo (`aria-hidden`) y no representa datos: los nodos no son
 * clientes ni sitios reales, solo la idea de varias soluciones en un centro.
 */
export default function NucleoDigital() {
  const px = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 });
  const rotY = useTransform(px, [-0.5, 0.5], [-9, 9]);
  const rotX = useTransform(py, [-0.5, 0.5], [7, -7]);

  function alMover(e: PointerEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - caja.left) / caja.width - 0.5);
    py.set((e.clientY - caja.top) / caja.height - 0.5);
  }
  function alSalir() {
    px.set(0);
    py.set(0);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="nucleo-escena" aria-hidden="true" onPointerMove={alMover} onPointerLeave={alSalir}>
        <motion.div
          className="nucleo"
          style={{ rotateX: rotX, rotateY: rotY }}
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: SUAVE, delay: 0.25 }}
        >
          <span className="nucleo__halo" />
          <span className="nucleo__suelo" />

          {/* Conexiones: del centro a cada pieza flotante (mismas coordenadas que
              en el CSS de `.pieza--*`). */}
          <svg className="nucleo__lineas" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="50" y1="50" x2="14" y2="22" />
            <line x1="50" y1="50" x2="88" y2="30" />
            <line x1="50" y1="50" x2="82" y2="84" />
            <line x1="50" y1="50" x2="10" y2="76" />
          </svg>

          {/* Cada anillo gira sobre su propio plano inclinado; sus nodos giran en
              sentido contrario para quedar siempre de frente a la pantalla. */}
          <span className="anillo anillo--a" style={{ "--incl": "24deg", "--dur": "46s" } as CSSProperties}>
            <i className="nodo" style={{ "--ang": "0deg" } as CSSProperties} />
            <i className="nodo nodo--chico" style={{ "--ang": "180deg" } as CSSProperties} />
          </span>
          <span className="anillo anillo--b" style={{ "--incl": "-38deg", "--dur": "64s" } as CSSProperties}>
            <i className="nodo nodo--chico" style={{ "--ang": "90deg" } as CSSProperties} />
            <i className="nodo" style={{ "--ang": "250deg" } as CSSProperties} />
          </span>
          <span className="anillo anillo--c" style={{ "--incl": "62deg", "--dur": "86s" } as CSSProperties}>
            <i className="nodo nodo--chico" style={{ "--ang": "40deg" } as CSSProperties} />
          </span>

          <motion.span
            className="nucleo__centro"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: SUAVE, delay: 0.5 }}
          >
            <img src={isotipo} alt="" width={560} height={461} decoding="async" />
            {/* El brillo recorre solo la silueta del isotipo (máscara). */}
            <span className="nucleo__brillo" style={{ "--silueta": `url(${isotipo})` } as CSSProperties} />
          </motion.span>

          {/* Piezas flotantes: vidrio y metal, a distintas profundidades. */}
          <motion.span className="pieza pieza--cubo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }} />
          <motion.span className="pieza pieza--rombo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }} />
          <motion.span className="pieza pieza--aro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} />
          <motion.span className="pieza pieza--placa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 1 }} />
        </motion.div>
      </div>
    </MotionConfig>
  );
}
