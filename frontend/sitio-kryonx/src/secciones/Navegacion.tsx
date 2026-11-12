import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Boton } from "../componentes/Boton";
import { Logo } from "../componentes/Logo";
import type { DatosNavegacion, Solucion } from "../contenido/tipos";
import { irA } from "../hooks/desplazamiento";
import { registrar } from "../lib/analitica";
import { elegirSolucion } from "../lib/solucion";

/**
 * Compacta y de cristal. «Soluciones» se despliega con una entrada por
 * modalidad; el resto son enlaces. En el móvil el menú es una hoja completa:
 * cinco enlaces no justifican un desplegable diminuto que hay que acertar con
 * el pulgar, y el botón «Empezar» sigue a la vista.
 *
 * El primer enlace va antes del menú de soluciones y el resto después, que es
 * el orden de lectura: Inicio · Soluciones · Experiencias · Proyectos · Nosotros.
 */
export function Navegacion({ datos }: { datos: DatosNavegacion }) {
  const { scrollY } = useScroll();
  const [solida, setSolida] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [menuSoluciones, setMenuSoluciones] = useState(false);
  const zonaSoluciones = useRef<HTMLDivElement>(null);

  useMotionValueEvent(scrollY, "change", (y) => setSolida(y > 24));

  /* La hoja del móvil bloquea el scroll y se cierra con Escape. */
  useEffect(() => {
    document.body.classList.toggle("sin-scroll", abierta);
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  /* El menú de escritorio se cierra con Escape y al hacer clic fuera. */
  useEffect(() => {
    if (!menuSoluciones) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setMenuSoluciones(false);
    const alPulsarFuera = (e: Event) => {
      if (!zonaSoluciones.current?.contains(e.target as Node)) setMenuSoluciones(false);
    };
    window.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alPulsarFuera);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alPulsarFuera);
    };
  }, [menuSoluciones]);

  function alPulsar(evento: MouseEvent<HTMLAnchorElement>, href: string) {
    setAbierta(false);
    setMenuSoluciones(false);
    if (irA(href)) evento.preventDefault();
  }

  function alElegirSolucion(evento: MouseEvent<HTMLAnchorElement>, solucion: Solucion, href: string) {
    registrar("solucion_seleccionada", { solucion, origen: "navegacion" });
    elegirSolucion(solucion, "navegacion");
    alPulsar(evento, href);
  }

  const [inicio, ...resto] = datos.enlaces;

  return (
    <>
      <motion.header
        className={`nav ${solida ? "nav--solida" : ""}`}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="nav__interior">
          <a href="#inicio" className="nav__marca" onClick={(e) => alPulsar(e, "#inicio")} aria-label="Crafteech, ir al inicio">
            <Logo />
          </a>

          <nav className="nav__enlaces" aria-label="Secciones">
            {inicio && (
              <a href={inicio.href} onClick={(e) => alPulsar(e, inicio.href)}>
                {inicio.etiqueta}
              </a>
            )}

            <div
              className="nav__soluciones"
              ref={zonaSoluciones}
              onMouseEnter={() => setMenuSoluciones(true)}
              onMouseLeave={() => setMenuSoluciones(false)}
            >
              <button
                type="button"
                className="nav__disparador"
                aria-expanded={menuSoluciones}
                aria-controls="menu-soluciones"
                onClick={() => setMenuSoluciones((a) => !a)}
              >
                Soluciones
                <ChevronDown aria-hidden="true" />
              </button>
              <AnimatePresence>
                {menuSoluciones && (
                  <motion.ul
                    id="menu-soluciones"
                    className="nav__menu-soluciones"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {datos.soluciones.map((s) => (
                      <li key={s.solucion}>
                        <a href={s.href} onClick={(e) => alElegirSolucion(e, s.solucion, s.href)}>
                          <strong>{s.nombre}</strong>
                          <span>{s.detalle}</span>
                        </a>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {resto.map((enlace) => (
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
              {inicio && (
                <MotionEnlace i={0} href={inicio.href} onClick={(e) => alPulsar(e, inicio.href)}>
                  {inicio.etiqueta}
                </MotionEnlace>
              )}
              {datos.soluciones.map((s, i) => (
                <MotionEnlace
                  key={s.solucion}
                  i={i + 1}
                  href={s.href}
                  subnivel
                  onClick={(e) => alElegirSolucion(e, s.solucion, s.href)}
                >
                  {s.nombre}
                  <small>{s.detalle}</small>
                </MotionEnlace>
              ))}
              {resto.map((enlace, i) => (
                <MotionEnlace
                  key={enlace.href}
                  i={i + 1 + datos.soluciones.length}
                  href={enlace.href}
                  onClick={(e) => alPulsar(e, enlace.href)}
                >
                  {enlace.etiqueta}
                </MotionEnlace>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
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

function MotionEnlace({
  i,
  href,
  subnivel = false,
  onClick,
  children,
}: {
  i: number;
  href: string;
  subnivel?: boolean;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <motion.a
      href={href}
      className={subnivel ? "hoja__sub" : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * i + 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.a>
  );
}
