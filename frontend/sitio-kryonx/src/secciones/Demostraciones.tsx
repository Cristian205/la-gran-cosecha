import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import type { CasoDemostracion, DatosDemostraciones } from "../contenido/tipos";

/**
 * Tiendas de verdad hechas con Kryon X.
 *
 * El resto de la página enseña maquetas; esta sección enseña capturas de
 * tiendas publicadas, que es lo que convence a quien duda de si «sin
 * plantillas que se repitan» es una promesa o un hecho. El marco recorre la
 * página entera de arriba abajo sin que nadie haga nada —una tienda no se
 * entiende por su primera pantalla— y el teléfono delante enseña que la misma
 * tienda ya está resuelta en el móvil.
 */
export function Demostraciones({ datos, id }: { datos: DatosDemostraciones; id: string }) {
  const [activo, setActivo] = useState(0);
  const caso = datos.casos[activo];
  if (!caso) return null;

  // Flechas entre pestañas, como pide el patrón de tabs de WAI-ARIA.
  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = (activo + paso + datos.casos.length) % datos.casos.length;
    setActivo(siguiente);
    document.getElementById(`${id}-pestana-${siguiente}`)?.focus();
  }

  return (
    <section className="seccion demos" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <Revelar retraso={0.1}>
          <div className="demos__pestanas" role="tablist" aria-label="Tiendas de ejemplo" onKeyDown={alTeclear}>
            {datos.casos.map((c, i) => (
              <button
                key={c.id}
                id={`${id}-pestana-${i}`}
                type="button"
                role="tab"
                aria-selected={i === activo}
                aria-controls={`${id}-panel`}
                tabIndex={i === activo ? 0 : -1}
                className={`demos__pestana ${i === activo ? "es-activa" : ""}`}
                onClick={() => setActivo(i)}
              >
                <span className="demos__pestana-nombre">{c.nombre}</span>
                <span className="demos__pestana-rubro">{c.plantilla}</span>
              </button>
            ))}
          </div>
        </Revelar>

        <div
          className="demos__panel"
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-pestana-${activo}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={caso.id}
              className="demos__escena"
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

function Ficha({ caso }: { caso: CasoDemostracion }) {
  return (
    <div className="demos__ficha">
      <span className="demos__plantilla">{caso.plantilla}</span>
      <h3 className="demos__nombre">{caso.nombre}</h3>
      <p className="demos__rubro">{caso.rubro}</p>
      <p className="demos__descripcion">{caso.descripcion}</p>
      <ul className="demos__rasgos">
        {caso.rasgos.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {caso.enlace && (
        <a className="demos__enlace" href={caso.enlace.href} target="_blank" rel="noreferrer">
          {caso.enlace.etiqueta}
          <ArrowUpRight aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function Pantallas({ caso }: { caso: CasoDemostracion }) {
  const estilo = { "--recorrido": `${caso.recorrido}s` } as CSSProperties;
  return (
    <div className="demos__pantallas" style={estilo}>
      <Marco dominio={caso.dominio} className="demos__marco">
        <div className="demos__ventana">
          <img
            src={caso.escritorio}
            alt={`Página de inicio de ${caso.nombre} en el escritorio, de arriba abajo`}
            loading="lazy"
            decoding="async"
          />
        </div>
      </Marco>
      <div className="demos__telefono">
        <img src={caso.movil} alt={`${caso.nombre} en el móvil`} loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
