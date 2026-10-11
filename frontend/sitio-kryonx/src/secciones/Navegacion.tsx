import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Boton } from "../componentes/Boton";
import { Logo } from "../componentes/Logo";
import type { DatosNavegacion } from "../contenido/tipos";
import { irA } from "../hooks/desplazamiento";

/**
 * Transparente sobre el hero, cristal en cuanto la página se mueve. En el
 * móvil el menú es una hoja completa: cuatro enlaces no justifican un
 * desplegable diminuto que hay que acertar con el pulgar.
 */
export function Navegacion({ datos }: { datos: DatosNavegacion }) {
  const { scrollY } = useScroll();
  const [solida, setSolida] = useState(false);
  const [abierta, setAbierta] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setSolida(y > 24));

  useEffect(() => {
    document.body.classList.toggle("sin-scroll", abierta);
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  function alPulsar(evento: MouseEvent<HTMLAnchorElement>, href: string) {
    setAbierta(false);
    if (irA(href)) evento.preventDefault();
  }

  return (
    <>
      <motion.header
        className={`nav ${solida ? "nav--solida" : ""}`}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="nav__interior">
          <a href="#inicio" className="nav__marca" onClick={(e) => alPulsar(e, "#inicio")} aria-label="Kryon X, ir al inicio">
            <Logo />
          </a>

          <nav className="nav__enlaces" aria-label="Secciones">
            {datos.enlaces.map((enlace) => (
              <a key={enlace.href} href={enlace.href} onClick={(e) => alPulsar(e, enlace.href)}>
                {enlace.etiqueta}
              </a>
            ))}
          </nav>

          <div className="nav__acciones">
            <Boton enlace={datos.cta} variante="primario" icono={false} />
            <button
              type="button"
              className="nav__menu"
              aria-label={abierta ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={abierta}
              aria-controls="menu-movil"
              onClick={() => setAbierta((a) => !a)}
            >
              {abierta ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {abierta && (
          <motion.div
            id="menu-movil"
            className="hoja"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <nav aria-label="Secciones">
              {datos.enlaces.map((enlace, i) => (
                <motion.a
                  key={enlace.href}
                  href={enlace.href}
                  onClick={(e) => alPulsar(e, enlace.href)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i + 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span>0{i + 1}</span>
                  {enlace.etiqueta}
                </motion.a>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              onClick={() => setAbierta(false)}
            >
              <Boton enlace={datos.cta} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
