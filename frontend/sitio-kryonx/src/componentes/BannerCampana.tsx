import { useEffect, useState, type CSSProperties } from "react";
import { Sparkles, Star } from "lucide-react";
import type { Campana } from "../contenido/tipos";
import { Objeto } from "./Objeto";

/**
 * Una pieza publicitaria dentro de la portada de una maqueta.
 *
 * Cada formato tiene composición propia y no solo otro color: es lo que hace
 * creíble que la tienda sirve de canal de marketing. Un banner de temporada,
 * una oferta con cuenta regresiva y un lanzamiento no se diseñan igual.
 */
export function BannerCampana({ campana }: { campana: Campana }) {
  const estilo = {
    "--c-fondo": campana.colores[0],
    "--c-acento": campana.colores[1],
  } as CSSProperties;

  return (
    <div className={`banner banner--${campana.formato}`} style={estilo}>
      <Composicion campana={campana} />
    </div>
  );
}

function Composicion({ campana }: { campana: Campana }) {
  const { formato, antetitulo, titulo, texto, cta, colores } = campana;

  switch (formato) {
    case "flash":
      return (
        <>
          <div className="banner__texto">
            <span className="banner__ante">
              <Sparkles /> {antetitulo}
            </span>
            <strong className="banner__gigante">{titulo}</strong>
            <span className="banner__parrafo">{texto}</span>
          </div>
          <div className="banner__lado">
            <CuentaRegresiva />
            <span className="banner__boton">{cta}</span>
          </div>
        </>
      );

    case "producto":
      return (
        <>
          <div className="banner__orbita" aria-hidden="true">
            <Objeto forma="circulo" color={["#b6a6ff", colores[1]]} className="banner__objeto" />
          </div>
          <div className="banner__texto banner__texto--centro">
            <span className="banner__ante">{antetitulo}</span>
            <strong className="banner__titulo">{titulo}</strong>
            <span className="banner__parrafo">{texto}</span>
            <span className="banner__boton">{cta}</span>
          </div>
        </>
      );

    case "destacada":
      return (
        <>
          <div className="banner__marca">
            <span className="banner__chip">
              <Star /> Patrocinado
            </span>
            <span className="banner__ante">{antetitulo}</span>
            <strong className="banner__titulo">{titulo}</strong>
            <span className="banner__boton">{cta}</span>
          </div>
          <div className="banner__vitrina" aria-hidden="true">
            <Objeto forma="arco" color={["#d9c7ad", "#8f7457"]} />
            <Objeto forma="botella" color={["#2b2b2b", "#0c0c0c"]} />
          </div>
        </>
      );

    case "seccion":
      return (
        <div className="banner__mosaico">
          <div className="banner__mosaico-cabeza">
            <span className="banner__ante">{antetitulo}</span>
            <strong className="banner__titulo">{titulo}</strong>
          </div>
          {texto.split("·").map((pieza, i) => (
            <span key={pieza} className={`banner__tesela banner__tesela--${i}`}>
              {pieza.trim()}
            </span>
          ))}
        </div>
      );

    case "temporada":
    case "hero":
    default:
      return (
        <>
          <div className="banner__texto">
            <span className="banner__ante">{antetitulo}</span>
            <strong className="banner__titulo">{titulo}</strong>
            <span className="banner__parrafo">{texto}</span>
            <span className="banner__boton">{cta}</span>
          </div>
          <div className="banner__lado" aria-hidden="true">
            {formato === "temporada" ? (
              <Objeto forma="cubo" color={[colores[1], "#9c7a2c"]} className="banner__objeto" />
            ) : (
              <Objeto forma="capsula" color={["#8fa9ff", colores[1]]} className="banner__objeto" />
            )}
          </div>
        </>
      );
  }
}

/** Una cuenta regresiva que corre de verdad: la urgencia es el formato. */
function CuentaRegresiva() {
  const [restante, setRestante] = useState(47 * 3600 + 59 * 60 + 59);

  useEffect(() => {
    const reloj = window.setInterval(
      () => setRestante((s) => (s > 0 ? s - 1 : 47 * 3600)),
      1000
    );
    return () => window.clearInterval(reloj);
  }, []);

  const partes = [Math.floor(restante / 3600), Math.floor((restante % 3600) / 60), restante % 60];
  return (
    <span className="banner__reloj" aria-label="Tiempo restante de la oferta">
      {partes.map((n, i) => (
        <span key={i} className="banner__digito">
          {String(n).padStart(2, "0")}
        </span>
      ))}
    </span>
  );
}
