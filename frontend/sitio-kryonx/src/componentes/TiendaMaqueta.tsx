import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link2, Menu, Search, ShoppingBag, User } from "lucide-react";
import type { Campana, FuenteTitulos, TemaTienda, ZonaTienda } from "../contenido/tipos";
import { BannerCampana } from "./BannerCampana";
import { FUENTES } from "./fuentes";
import { Objeto } from "./Objeto";

/**
 * Una tienda en miniatura, pintada a partir de un `TemaTienda`.
 *
 * Es la pieza que se repite en toda la página —el hero, el constructor, las
 * campañas, la vitrina y la demostración responsive— y por eso es UNA: si
 * cada sección dibujara su propia tienda, la promesa de "un solo constructor,
 * tiendas distintas" la estaría desmintiendo el propio código.
 *
 * Todo se mide en `em` y el `em` sale del ancho del contenedor (`cqi`), así
 * que la misma maqueta se ve proporcionada a 1100px y a 220px. Por debajo de
 * cierto ancho cambia a su versión móvil con una consulta de contenedor, como
 * lo haría una tienda real.
 */

export interface AjustesMaqueta {
  acento?: string;
  fuente?: FuenteTitulos;
  columnas?: 2 | 3 | 4;
  heroCentrado?: boolean;
  categoriasEnCirculo?: boolean;
  sinPromo?: boolean;
  navOscura?: boolean;
  /** Desplaza qué imagen le toca a cada producto: "cambiar el contenido visual". */
  paleta?: number;
  anuncio?: string;
}

interface Props {
  tema: TemaTienda;
  ajustes?: AjustesMaqueta;
  /** Zona marcada como seleccionada en el editor. */
  resaltar?: ZonaTienda | null;
  etiquetaResaltado?: string;
  /** Si llega, la portada la ocupa esta campaña en vez del hero del tema. */
  campana?: Campana | null;
  /** Sin carrusel ni pie: para vitrinas donde solo se ve la parte de arriba. */
  compacta?: boolean;
  /** Desplaza la tienda para que la zona resaltada quede a la vista. */
  seguirZona?: boolean;
  className?: string;
}

/** Las zonas globales no tienen un sitio propio: se señalan sobre otra. */
const ZONA_VISIBLE: Partial<Record<ZonaTienda, ZonaTienda>> = {
  estilo: "home",
  contenido: "productos",
  componentes: "promo",
};

export function TiendaMaqueta({
  tema,
  ajustes = {},
  resaltar = null,
  etiquetaResaltado,
  campana = null,
  compacta = false,
  seguirZona = false,
  className = "",
}: Props) {
  const acento = ajustes.acento ?? tema.acento;
  const fuente = ajustes.fuente ?? tema.fuente;
  const columnas = ajustes.columnas ?? 4;
  const paleta = ajustes.paleta ?? 0;
  const visible = resaltar ? ZONA_VISIBLE[resaltar] ?? resaltar : null;

  const estilo = {
    "--t-fondo": tema.fondo,
    "--t-sup": tema.superficie,
    "--t-texto": tema.texto,
    "--t-tenue": tema.tenue,
    "--t-acento": acento,
    "--t-sobre": ajustes.acento ? "#ffffff" : tema.sobreAcento,
    "--t-radio": `${tema.radio}em`,
    "--t-fuente": FUENTES[fuente].css,
  } as CSSProperties;

  const productos = tema.productos.map((p, i) => ({
    ...p,
    color: tema.productos[(i + paleta) % tema.productos.length].color,
  }));

  /* Seguir la zona: se mide dónde está y se desplaza el lienzo, acotado para
     no enseñar vacío por debajo del pie. */
  const ventana = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);

  useLayoutEffect(() => {
    if (!seguirZona || !ventana.current || !lienzo.current) return;
    const zona = visible
      ? lienzo.current.querySelector<HTMLElement>(`[data-zona="${visible}"]`)
      : null;
    if (!zona) return setDesplazamiento(0);
    const alto = ventana.current.clientHeight;
    const maximo = Math.max(0, lienzo.current.scrollHeight - alto);
    const objetivo = zona.offsetTop - alto * 0.18;
    setDesplazamiento(Math.min(maximo, Math.max(0, objetivo)));
  }, [visible, seguirZona, columnas, ajustes.sinPromo, ajustes.categoriasEnCirculo]);

  const zona = (id: ZonaTienda, hijos: ReactNode, clase = "") => (
    <div
      data-zona={id}
      className={`tm__zona ${clase} ${visible === id ? "tm__zona--activa" : ""}`}
    >
      {visible === id && etiquetaResaltado && (
        <span className="tm__etiqueta">{etiquetaResaltado}</span>
      )}
      {hijos}
    </div>
  );

  return (
    <div
      className={`tm ${className}`}
      style={estilo}
      data-fuente={fuente}
      data-mayus={tema.mayusculas ? "" : undefined}
      data-estilo={resaltar === "estilo" ? "" : undefined}
    >
      <div className="tm__ventana" ref={ventana}>
        <div
          className="tm__lienzo"
          ref={lienzo}
          style={{ transform: `translate3d(0, ${-desplazamiento}px, 0)` }}
        >
          {zona(
            "banners",
            <div className="tm__anuncio">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={campana?.anuncio ?? ajustes.anuncio ?? tema.anuncio}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  {campana?.anuncio ?? ajustes.anuncio ?? tema.anuncio}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          {zona(
            "navbar",
            <header className={`tm__nav ${ajustes.navOscura ? "tm__nav--oscura" : ""}`}>
              <span className="tm__logo">{tema.nombre}</span>
              <nav className="tm__menu">
                {tema.categorias.slice(0, 3).map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </nav>
              <span className="tm__iconos">
                <Search />
                <User />
                <ShoppingBag />
                <Menu className="tm__hamburguesa" />
              </span>
            </header>
          )}

          {zona(
            "home",
            <AnimatePresence mode="popLayout" initial={false}>
              {campana ? (
                <motion.div
                  key={campana.id}
                  className="tm__portada"
                  initial={{ opacity: 0, scale: 1.03, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  <BannerCampana campana={campana} />
                </motion.div>
              ) : (
                <motion.div
                  key={`${tema.id}-${ajustes.heroCentrado ? "c" : "d"}`}
                  className={`tm__portada tm__hero ${ajustes.heroCentrado ? "tm__hero--centrado" : ""}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <div className="tm__hero-texto">
                    <span className="tm__ante">{tema.hero.antetitulo}</span>
                    <strong className="tm__titular">{tema.hero.titulo}</strong>
                    <span className="tm__boton">{tema.hero.cta}</span>
                  </div>
                  <div className="tm__hero-objeto">
                    <Objeto
                      forma={tema.hero.forma}
                      color={paleta ? productos[0].color : tema.hero.objeto}
                    />
                  </div>
                  <span className="tm__puntos" aria-hidden="true">
                    <i className="activo" />
                    <i />
                    <i />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {zona(
            "categorias",
            <div className={`tm__categorias ${ajustes.categoriasEnCirculo ? "tm__categorias--circulo" : ""}`}>
              {tema.categorias.map((c, i) => (
                <span key={c} className="tm__categoria">
                  {ajustes.categoriasEnCirculo && (
                    <Objeto forma={productos[i].forma} color={productos[i].color} />
                  )}
                  {c}
                </span>
              ))}
            </div>
          )}

          {zona(
            "productos",
            <section className="tm__seccion">
              <div className="tm__cabeza">
                <strong>Lo más nuevo</strong>
                <span>Ver todo</span>
              </div>
              <div className="tm__grilla" style={{ "--cols": columnas } as CSSProperties}>
                {productos.slice(0, columnas === 3 ? 3 : 4).map((p) => (
                  <motion.article layout key={p.nombre} className="tm__producto">
                    <div className="tm__foto">
                      <Objeto forma={p.forma} color={p.color} />
                    </div>
                    <span className="tm__nombre">{p.nombre}</span>
                    <span className="tm__precio">{p.precio}</span>
                  </motion.article>
                ))}
              </div>
            </section>
          )}

          {!compacta &&
            zona(
              "carrusel",
              <div className="tm__carrusel" aria-hidden="true">
                <div className="tm__carrusel-pista">
                  {[...productos, ...productos].map((p, i) => (
                    <span key={i} className="tm__diapositiva" style={{ "--o1": p.color[0], "--o2": p.color[1] } as CSSProperties}>
                      <span>{p.nombre}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

          {!ajustes.sinPromo &&
            zona(
              "promo",
              <div className={`tm__promos ${resaltar === "componentes" ? "tm__promos--doble" : ""}`}>
                {(resaltar === "componentes" ? [0, 1] : [0]).map((i) => (
                  <div key={i} className="tm__promo">
                    {resaltar === "componentes" && (
                      <span className="tm__reutilizado">
                        <Link2 /> Componente
                      </span>
                    )}
                    <strong>{tema.promo.titulo}</strong>
                    <span>{tema.promo.texto}</span>
                  </div>
                ))}
              </div>
            )}

          {!compacta &&
            zona(
              "footer",
              <footer className="tm__pie">
                <div>
                  <span className="tm__logo">{tema.nombre}</span>
                  <i className="tm__linea" style={{ width: "80%" }} />
                  <i className="tm__linea" style={{ width: "55%" }} />
                </div>
                {["Tienda", "Ayuda", "Contacto"].map((t) => (
                  <div key={t}>
                    <strong>{t}</strong>
                    <i className="tm__linea" style={{ width: "70%" }} />
                    <i className="tm__linea" style={{ width: "50%" }} />
                    <i className="tm__linea" style={{ width: "62%" }} />
                  </div>
                ))}
              </footer>
            )}
        </div>
      </div>
    </div>
  );
}
