import { AnimatePresence, motion } from "motion/react";
import {
  Blocks,
  Columns3,
  Footprints,
  GalleryHorizontal,
  Image,
  LayoutPanelTop,
  Link2,
  Megaphone,
  Navigation,
  Paintbrush,
  Shapes,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Encabezado } from "../componentes/Encabezado";
import { FUENTES } from "../componentes/fuentes";
import { Marco } from "../componentes/Marco";
import { Revelar } from "../componentes/Revelar";
import { TiendaMaqueta, type AjustesMaqueta } from "../componentes/TiendaMaqueta";
import type { DatosConstructor, FuenteTitulos, ZonaTienda } from "../contenido/tipos";
import { usarTema } from "../contenido/usarContenido";
import { usarAutoavance } from "../hooks/usarAutoavance";

const ICONO_ZONA: Record<ZonaTienda, LucideIcon> = {
  home: LayoutPanelTop,
  navbar: Navigation,
  banners: Megaphone,
  carrusel: GalleryHorizontal,
  productos: Columns3,
  categorias: Tag,
  promo: Shapes,
  footer: Footprints,
  estilo: Paintbrush,
  componentes: Blocks,
  contenido: Image,
};

const ACENTOS = ["#d4567a", "#7c4dff", "#0f8b6c", "#e2572b", "#1f2a44"];
const FUENTES_DEMO: FuenteTitulos[] = ["display", "editorial", "grotesca"];
const ANUNCIOS = [
  "Muestras gratis en cada pedido",
  "Nueva colección: Ritual de noche",
  "Envío en 24 h a todo el país",
];

/**
 * Lo que haría alguien en su primera tarde con el editor, aplicado solo:
 * al llegar a cada zona se hace el cambio típico de esa zona. Así la
 * demostración enseña el RESULTADO de editar, no una lista de lo editable.
 */
function cambioDeDemostracion(zona: ZonaTienda, a: AjustesMaqueta): AjustesMaqueta {
  switch (zona) {
    case "home":
      return { ...a, heroCentrado: !a.heroCentrado };
    case "navbar":
      return { ...a, navOscura: !a.navOscura };
    case "banners":
      return { ...a, anuncio: ANUNCIOS[(ANUNCIOS.indexOf(a.anuncio ?? ANUNCIOS[0]) + 1) % ANUNCIOS.length] };
    case "productos":
      return { ...a, columnas: a.columnas === 3 ? 4 : 3 };
    case "categorias":
      return { ...a, categoriasEnCirculo: !a.categoriasEnCirculo };
    case "estilo": {
      const i = ACENTOS.indexOf(a.acento ?? ACENTOS[0]);
      return { ...a, acento: ACENTOS[(i + 1) % ACENTOS.length], fuente: FUENTES_DEMO[(i + 1) % FUENTES_DEMO.length] };
    }
    case "contenido":
      return { ...a, paleta: ((a.paleta ?? 0) + 1) % 3 };
    default:
      return a;
  }
}

export function Constructor({ datos, id }: { datos: DatosConstructor; id: string }) {
  const tema = usarTema(datos.tema);
  const zona = useRef<HTMLDivElement>(null);
  const { indice, elegir, corriendo } = usarAutoavance(datos.zonas.length, 3600, zona);
  const [ajustes, setAjustes] = useState<AjustesMaqueta>({});
  const activa = datos.zonas[indice];

  useEffect(() => {
    if (!corriendo || !activa) return;
    const reloj = window.setTimeout(() => setAjustes((a) => cambioDeDemostracion(activa.id, a)), 1300);
    return () => window.clearTimeout(reloj);
  }, [indice, corriendo, activa]);

  const cambiar = (parcial: AjustesMaqueta) => {
    elegir(indice);
    setAjustes((a) => ({ ...a, ...parcial }));
  };

  if (!activa) return null;

  return (
    <section className="seccion constructor" id={id} aria-labelledby={`${id}-titulo`}>
      <div className="contenedor">
        <Encabezado datos={datos} id={`${id}-titulo`} />

        <div className="constructor__taller" ref={zona}>
          <Revelar className="constructor__zonas" desde={20}>
            <span className="constructor__rotulo">Editando · {tema.nombre}</span>
            <div className="constructor__lista" role="tablist" aria-label="Zonas de la tienda">
              {datos.zonas.map((z, i) => {
                const Icono = ICONO_ZONA[z.id];
                const seleccionada = i === indice;
                return (
                  <button
                    key={z.id}
                    type="button"
                    role="tab"
                    aria-selected={seleccionada}
                    className={`constructor__zona ${seleccionada ? "activa" : ""}`}
                    onClick={() => elegir(i)}
                  >
                    {seleccionada && (
                      <motion.span layoutId="zona-activa" className="constructor__fondo-activo" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                    )}
                    <Icono className="constructor__icono" aria-hidden="true" />
                    <span className="constructor__nombre">{z.nombre}</span>
                    {seleccionada && corriendo && (
                      <motion.i
                        key={indice}
                        className="constructor__progreso"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 3.6, ease: "linear" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Revelar>

          <Revelar className="constructor__escena" retraso={0.1} desde={40}>
            <Marco dominio={`${tema.nombre.toLowerCase().replace(/\s+/g, "")}.kryonx.co`} className="constructor__marco">
              <TiendaMaqueta
                tema={tema}
                ajustes={ajustes}
                resaltar={activa.id}
                etiquetaResaltado={activa.nombre}
                seguirZona
              />
            </Marco>

            <AnimatePresence mode="wait">
              <motion.div
                key={activa.id}
                className="inspector"
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="inspector__titulo">{activa.nombre}</span>
                <span className="inspector__detalle">{activa.detalle}</span>
                <Controles zona={activa.id} ajustes={ajustes} cambiar={cambiar} />
              </motion.div>
            </AnimatePresence>
          </Revelar>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Controles({
  zona,
  ajustes,
  cambiar,
}: {
  zona: ZonaTienda;
  ajustes: AjustesMaqueta;
  cambiar: (parcial: AjustesMaqueta) => void;
}) {
  switch (zona) {
    case "home":
      return (
        <Segmentado
          nombre="portada"
          opciones={["Dividida", "Centrada"]}
          valor={ajustes.heroCentrado ? 1 : 0}
          alElegir={(i) => cambiar({ heroCentrado: i === 1 })}
        />
      );
    case "navbar":
      return (
        <Segmentado
          nombre="navbar"
          opciones={["Clara", "Oscura"]}
          valor={ajustes.navOscura ? 1 : 0}
          alElegir={(i) => cambiar({ navOscura: i === 1 })}
        />
      );
    case "banners":
      return (
        <div className="inspector__opciones">
          {ANUNCIOS.map((texto) => (
            <button
              key={texto}
              type="button"
              className={`inspector__opcion ${(ajustes.anuncio ?? ANUNCIOS[0]) === texto ? "activa" : ""}`}
              onClick={() => cambiar({ anuncio: texto })}
            >
              {texto}
            </button>
          ))}
        </div>
      );
    case "productos":
      return (
        <Segmentado
          nombre="columnas"
          opciones={["2", "3", "4"]}
          valor={(ajustes.columnas ?? 4) - 2}
          alElegir={(i) => cambiar({ columnas: (i + 2) as 2 | 3 | 4 })}
        />
      );
    case "categorias":
      return (
        <Segmentado
          nombre="categorias"
          opciones={["Etiquetas", "Círculos"]}
          valor={ajustes.categoriasEnCirculo ? 1 : 0}
          alElegir={(i) => cambiar({ categoriasEnCirculo: i === 1 })}
        />
      );
    case "promo":
      return (
        <Segmentado
          nombre="promo"
          opciones={["Visible", "Oculta"]}
          valor={ajustes.sinPromo ? 1 : 0}
          alElegir={(i) => cambiar({ sinPromo: i === 1 })}
        />
      );
    case "estilo":
      return (
        <>
          <div className="inspector__muestras" role="radiogroup" aria-label="Color de marca">
            {ACENTOS.map((color) => {
              const activo = (ajustes.acento ?? "") === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  aria-label={`Color ${color}`}
                  style={{ background: color }}
                  className={activo ? "activa" : ""}
                  onClick={() => cambiar({ acento: color })}
                />
              );
            })}
          </div>
          <Segmentado
            nombre="fuente"
            opciones={FUENTES_DEMO.map((f) => FUENTES[f].nombre.split(" ")[0])}
            valor={Math.max(0, FUENTES_DEMO.indexOf(ajustes.fuente ?? "display"))}
            alElegir={(i) => cambiar({ fuente: FUENTES_DEMO[i] })}
          />
        </>
      );
    case "contenido":
      return (
        <Segmentado
          nombre="imagenes"
          opciones={["Set 1", "Set 2", "Set 3"]}
          valor={ajustes.paleta ?? 0}
          alElegir={(i) => cambiar({ paleta: i })}
        />
      );
    case "componentes":
      return (
        <span className="inspector__nota">
          <Link2 aria-hidden="true" /> Usado en 2 lugares · se actualiza en todos
        </span>
      );
    case "carrusel":
      return <span className="inspector__nota">Rotación automática cada 3 s</span>;
    default:
      return <span className="inspector__nota">Contacto, redes y enlaces legales</span>;
  }
}

function Segmentado({
  nombre,
  opciones,
  valor,
  alElegir,
}: {
  nombre: string;
  opciones: string[];
  valor: number;
  alElegir: (indice: number) => void;
}) {
  return (
    <div className="segmentado" role="radiogroup">
      {opciones.map((opcion, i) => (
        <button
          key={opcion}
          type="button"
          role="radio"
          aria-checked={i === valor}
          className={i === valor ? "activo" : ""}
          onClick={() => alElegir(i)}
        >
          {i === valor && (
            <motion.span layoutId={`segmento-${nombre}`} className="segmentado__fondo" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span>{opcion}</span>
        </button>
      ))}
    </div>
  );
}
