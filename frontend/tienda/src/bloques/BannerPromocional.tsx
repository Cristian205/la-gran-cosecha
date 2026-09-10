import Link from "next/link";
import { claseDeVariante } from "./Seccion";

/**
 * Una promoción con su imagen y su botón.
 *
 * Se parece al carrusel de promociones y no es lo mismo, y la diferencia
 * importa porque decide cuál poner. El carrusel es la CABECERA de la tienda:
 * va arriba, ocupa el ancho, rota y sale de una tabla que el negocio
 * administra. Esto es una promoción SUELTA que se coloca donde haga falta —a
 * mitad de la home, en una página de campaña— y se edita en el mismo sitio
 * donde se ve.
 *
 * Un negocio que quiera tres promos rotando usa el carrusel; uno que quiera
 * «esta semana, envío gratis» entre dos secciones usa esto.
 */
const VARIANTES = ["partido", "cubierto"] as const;

interface Props {
  titulo?: string;
  texto?: string;
  /** El texto pequeño de encima. «Solo hasta el viernes», «Nuevo». */
  kicker?: string;
  imagen_url?: string;
  imagen_alt?: string;
  boton_texto?: string;
  boton_href?: string;
  /** Solo en `cubierto`: cuánto se oscurece la foto para que el texto se lea.
   *  Va de 0 a 100 porque quien lo mueve está mirando el resultado, no
   *  calculando una opacidad. */
  oscurecer?: number;
  /** La imagen a la derecha en vez de a la izquierda. Es la propiedad que
   *  permite alternar dos banners seguidos sin que parezcan el mismo. */
  invertido?: boolean;
  variante?: string;
}

export function BannerPromocional({
  titulo = "",
  texto = "",
  kicker = "",
  imagen_url = "",
  imagen_alt = "",
  boton_texto = "",
  boton_href = "",
  oscurecer = 35,
  invertido = false,
  variante,
}: Props) {
  // Sin nada que decir no se pinta. Un banner con solo imagen es válido —una
  // promo puede ser solo un cartel— pero uno completamente vacío es un hueco.
  if (!titulo && !texto && !imagen_url) return null;

  const clase = claseDeVariante(variante, VARIANTES, "banner", "partido");
  const cubierto = clase === "banner--cubierto";

  const boton =
    boton_texto && boton_href ? (
      /^https?:\/\//.test(boton_href) ? (
        <a className="btn" href={boton_href} target="_blank" rel="noreferrer noopener">
          {boton_texto}
        </a>
      ) : (
        <Link className="btn" href={boton_href}>
          {boton_texto}
        </Link>
      )
    ) : null;

  return (
    <div
      className={`banner ${clase} ${invertido ? "banner--invertido" : ""}`.trim()}
      // El velo viaja como variable y no como clase porque es un valor
      // continuo: con clases habría que inventar «poco», «medio» y «mucho», y
      // quien lo ajusta está mirando si su texto se lee.
      style={cubierto ? { "--banner-velo": `${oscurecer / 100}` } as React.CSSProperties : undefined}
    >
      {imagen_url && (
        <div className="banner-foto">
          <img src={imagen_url} alt={imagen_alt || ""} loading="lazy" />
        </div>
      )}
      <div className="banner-texto">
        {kicker && <span className="banner-kicker">{kicker}</span>}
        {titulo && <h3>{titulo}</h3>}
        {texto && <p>{texto}</p>}
        {boton}
      </div>
    </div>
  );
}
