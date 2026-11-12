import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import type { CasoProyecto, DatosProyectos } from "../contenido/tipos";
import { registrar } from "../lib/analitica";

/**
 * Escena 05. Capturas de una tienda publicada, que es lo que convence a quien
 * duda de si «sin plantillas que se repitan» es una promesa o un hecho. El
 * marco recorre la página entera de arriba abajo sin que nadie haga nada —una
 * tienda no se entiende por su primera pantalla— y el teléfono delante enseña
 * que la misma tienda ya está resuelta en el móvil.
 *
 * Lo real y lo conceptual se rotulan distinto y se leen distinto: un concepto
 * dice «Demostración conceptual» en su insignia y no tiene enlace, para que
 * nunca pase por un proyecto realizado.
 */
export function Proyectos({ datos, id }: { datos: DatosProyectos; id: string }) {
  const [activo, setActivo] = useState(0);
  const caso = datos.casos[activo];
  if (!caso) return null;

  function elegir(i: number) {
    setActivo(i);
    const c = datos.casos[i];
    if (c) registrar("proyecto_visto", { proyecto: c.id, tipo: c.tipo });
  }

  // Flechas entre pestañas, como pide el patrón de tabs de WAI-ARIA.
  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = (activo + paso + datos.casos.length) % datos.casos.length;
    elegir(siguiente);
    document.getElementById(`${id}-pestana-${siguiente}`)?.focus();
  }

  return (
    <section className="seccion escena--oscura proyectos" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        {datos.casos.length > 1 && (
          <Revelar retraso={0.1}>
            <div className="proyectos__pestanas" role="tablist" aria-label="Proyectos" onKeyDown={alTeclear}>
              {datos.casos.map((c, i) => (
                <button
                  key={c.id}
                  id={`${id}-pestana-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === activo}
                  aria-controls={`${id}-panel`}
                  tabIndex={i === activo ? 0 : -1}
                  className={`pestana ${i === activo ? "activa" : ""}`}
                  onClick={() => elegir(i)}
                >
                  <span className="pestana__nombre">{c.nombre}</span>
                  <span className={`pestana__tipo pestana__tipo--${c.tipo}`}>{c.tipo === "real" ? "Proyecto real" : "Concepto"}</span>
                </button>
              ))}
            </div>
          </Revelar>
        )}

        <div className="proyectos__panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-pestana-${activo}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={caso.id}
              className="proyectos__escena"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Ficha caso={caso} />
              <Pantallas caso={caso} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Ficha({ caso }: { caso: CasoProyecto }) {
  return (
    <div className="ficha">
      <span className={`ficha__insignia ficha__insignia--${caso.tipo}`}>
        {caso.tipo === "real" ? "Proyecto realizado" : "Demostración conceptual"}
      </span>
      <h3 className="ficha__nombre">{caso.nombre}</h3>
      <p className="ficha__rubro">{caso.rubro}</p>

      <dl className="ficha__datos">
        <div>
          <dt>El reto</dt>
          <dd>{caso.reto}</dd>
        </div>
        <div>
          <dt>La solución</dt>
          <dd>{caso.solucion}</dd>
        </div>
      </dl>

      <ul className="ficha__funciones">
        {caso.funcionalidades.map((f) => (
          <li key={f}>
            <Check aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      {caso.enlace && (
        <a
          className="ficha__enlace"
          href={caso.enlace.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => registrar("proyecto_visto", { proyecto: caso.id, tipo: caso.tipo, accion: "visitar" })}
        >
          {caso.enlace.etiqueta}
          <ArrowUpRight aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function Pantallas({ caso }: { caso: CasoProyecto }) {
  const estilo = { "--recorrido": `${caso.recorrido}s` } as CSSProperties;
  return (
    <div className="pantallas" style={estilo}>
      <Marco dominio={caso.dominio} className="pantallas__marco">
        <div className="pantallas__ventana">
          <img
            src={caso.escritorio}
            alt={`Página de inicio de ${caso.nombre} en el escritorio, recorrida de arriba abajo`}
            loading="lazy"
            decoding="async"
          />
        </div>
      </Marco>
      <div className="pantallas__telefono">
        <img src={caso.movil} alt={`${caso.nombre} en el móvil`} loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
