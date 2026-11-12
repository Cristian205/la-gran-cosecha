import { AnimatePresence, motion } from "motion/react";
import { Monitor, RotateCcw, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { FUENTES } from "../componentes/fuentes";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import { TiendaMaqueta, type AjustesMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosPersonalizacion, FuenteTitulos } from "../contenido/tipos";
import { usarTema } from "../contenido/usarContenido";

type EstiloTarjeta = "suave" | "cuadrada" | "redonda";
type Vista = "escritorio" | "movil";

/** Radio de las piezas de la maqueta por estilo de tarjeta, en em. */
const RADIOS: Record<Exclude<EstiloTarjeta, "suave">, number> = { cuadrada: 0, redonda: 1.6 };

const ESTILOS: { id: EstiloTarjeta; etiqueta: string }[] = [
  { id: "suave", etiqueta: "Suave" },
  { id: "cuadrada", etiqueta: "Cuadrada" },
  { id: "redonda", etiqueta: "Redonda" },
];

/**
 * Escena 04. Un taller real, no un video: la persona cambia el color, la
 * tipografía, las tarjetas, el banner y las secciones de una tienda de ejemplo
 * y ve el resultado al instante, en escritorio o en móvil.
 *
 * Es una demostración independiente. Pinta una maqueta (`TiendaMaqueta`) con
 * ajustes en el estado de este componente; no habla con ninguna tienda ni con
 * el backend, y la página lo dice (`datos.aviso`) para que nadie crea que
 * edita algo real.
 */
export function Personalizacion({ datos, id }: { datos: DatosPersonalizacion; id: string }) {
  const base = usarTema(datos.tema);

  const inicial = {
    acento: datos.paletas[0]?.acento ?? base.acento,
    fuente: datos.fuentes[0] ?? base.fuente,
    tarjetas: "suave" as EstiloTarjeta,
    columnas: 4 as 2 | 3 | 4,
    centrado: false,
    anuncio: datos.anuncios[0] ?? base.anuncio,
    circulos: false,
    promo: true,
    vista: "escritorio" as Vista,
  };
  const [acento, setAcento] = useState(inicial.acento);
  const [fuente, setFuente] = useState<FuenteTitulos>(inicial.fuente);
  const [tarjetas, setTarjetas] = useState<EstiloTarjeta>(inicial.tarjetas);
  const [columnas, setColumnas] = useState<2 | 3 | 4>(inicial.columnas);
  const [centrado, setCentrado] = useState(inicial.centrado);
  const [anuncio, setAnuncio] = useState(inicial.anuncio);
  const [circulos, setCirculos] = useState(inicial.circulos);
  const [promo, setPromo] = useState(inicial.promo);
  const [vista, setVista] = useState<Vista>(inicial.vista);

  function restablecer() {
    setAcento(inicial.acento);
    setFuente(inicial.fuente);
    setTarjetas(inicial.tarjetas);
    setColumnas(inicial.columnas);
    setCentrado(inicial.centrado);
    setAnuncio(inicial.anuncio);
    setCirculos(inicial.circulos);
    setPromo(inicial.promo);
  }

  if (!base) return null;

  const tema = tarjetas === "suave" ? base : { ...base, radio: RADIOS[tarjetas] };
  const ajustes: AjustesMaqueta = {
    acento,
    fuente,
    columnas,
    heroCentrado: centrado,
    anuncio,
    categoriasEnCirculo: circulos,
    sinPromo: !promo,
  };
  const dominio = `${base.nombre.toLowerCase().replace(/\s+/g, "")}.com`;

  return (
    <section className="seccion escena--clara personalizacion" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <div className="taller">
          <Revelar className="taller__controles" desde={24}>
            <div className="taller__cabecera">
              <strong>Ajustes de la tienda</strong>
              <button type="button" className="taller__reiniciar" onClick={restablecer}>
                <RotateCcw aria-hidden="true" /> Restablecer
              </button>
            </div>

            <Grupo titulo="Color">
              <div className="muestras">
                {datos.paletas.map((p) => (
                  <button
                    key={p.acento}
                    type="button"
                    className={`muestra ${p.acento === acento ? "activa" : ""}`}
                    style={{ background: p.acento }}
                    aria-label={p.nombre}
                    aria-pressed={p.acento === acento}
                    onClick={() => setAcento(p.acento)}
                  />
                ))}
              </div>
            </Grupo>

            <Grupo titulo="Tipografía">
              <div className="opciones">
                {datos.fuentes.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`opcion opcion--fuente ${f === fuente ? "activa" : ""}`}
                    aria-pressed={f === fuente}
                    onClick={() => setFuente(f)}
                  >
                    <span style={{ fontFamily: FUENTES[f].css }}>Aa</span>
                    <small>{FUENTES[f].nombre}</small>
                  </button>
                ))}
              </div>
            </Grupo>

            <Grupo titulo="Tarjetas de producto">
              <div className="segmentos" role="group" aria-label="Estilo de tarjeta">
                {ESTILOS.map((e) => (
                  <button key={e.id} type="button" className={`segmento ${e.id === tarjetas ? "activo" : ""}`} aria-pressed={e.id === tarjetas} onClick={() => setTarjetas(e.id)}>
                    {e.etiqueta}
                  </button>
                ))}
              </div>
              <div className="segmentos" role="group" aria-label="Columnas">
                {([2, 3, 4] as const).map((n) => (
                  <button key={n} type="button" className={`segmento ${n === columnas ? "activo" : ""}`} aria-pressed={n === columnas} onClick={() => setColumnas(n)}>
                    {n} columnas
                  </button>
                ))}
              </div>
            </Grupo>

            <Grupo titulo="Banner principal">
              <div className="segmentos" role="group" aria-label="Alineación del banner">
                <button type="button" className={`segmento ${!centrado ? "activo" : ""}`} aria-pressed={!centrado} onClick={() => setCentrado(false)}>
                  A la izquierda
                </button>
                <button type="button" className={`segmento ${centrado ? "activo" : ""}`} aria-pressed={centrado} onClick={() => setCentrado(true)}>
                  Centrado
                </button>
              </div>
              <div className="opciones opciones--lista">
                {datos.anuncios.map((a) => (
                  <button key={a} type="button" className={`opcion opcion--texto ${a === anuncio ? "activa" : ""}`} aria-pressed={a === anuncio} onClick={() => setAnuncio(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </Grupo>

            <Grupo titulo="Secciones">
              <Interruptor activo={circulos} onCambio={setCirculos}>
                Categorías en círculo
              </Interruptor>
              <Interruptor activo={promo} onCambio={setPromo}>
                Bloque promocional
              </Interruptor>
            </Grupo>
          </Revelar>

          <Revelar className="taller__escena" retraso={0.1} desde={40}>
            <div className="vistas" role="group" aria-label="Vista previa">
              <button type="button" className={`vista ${vista === "escritorio" ? "activa" : ""}`} aria-pressed={vista === "escritorio"} onClick={() => setVista("escritorio")}>
                <Monitor aria-hidden="true" /> Escritorio
              </button>
              <button type="button" className={`vista ${vista === "movil" ? "activa" : ""}`} aria-pressed={vista === "movil"} onClick={() => setVista("movil")}>
                <Smartphone aria-hidden="true" /> Móvil
              </button>
            </div>

            <div className="taller__pantalla" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                {vista === "escritorio" ? (
                  <motion.div key="escritorio" className="taller__marco" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}>
                    <Marco dominio={dominio}>
                      <TiendaMaqueta tema={tema} ajustes={ajustes} compacta />
                    </Marco>
                  </motion.div>
                ) : (
                  <motion.div key="movil" className="taller__movil" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}>
                    <div className="telefono">
                      <span className="telefono__muesca" />
                      <div className="telefono__pantalla">
                        <TiendaMaqueta tema={tema} ajustes={ajustes} compacta />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="taller__aviso">{datos.aviso}</p>
          </Revelar>
        </div>
      </div>
    </section>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="grupo">
      <legend>{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Interruptor({ activo, onCambio, children }: { activo: boolean; onCambio: (valor: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={activo} className={`interruptor ${activo ? "activo" : ""}`} onClick={() => onCambio(!activo)}>
      <span className="interruptor__texto">{children}</span>
      <span className="interruptor__riel" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
