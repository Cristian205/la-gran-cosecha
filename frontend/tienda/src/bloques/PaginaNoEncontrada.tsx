import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * La página que se enseña cuando una ruta compuesta no existe.
 *
 * Vive en la ruta reservada `/_no-encontrada` (ver `RUTA_NO_ENCONTRADA` en
 * `lib/pagina.ts`), con el mismo criterio que `/_layout`: no es una página que
 * se visite, es una composición más que el negocio puede editar desde el
 * panel. Sin ella compuesta, `app/[ruta]/not-found.tsx` cae a un mensaje
 * genérico — nunca deja al visitante sin nada, pero tampoco inventa esta
 * ilustración por su cuenta.
 *
 * Igual que `Portada`: el número, el título y la ilustración son PROPS, no
 * código. Cambiar la imagen del camión por otra —o quitarla— es una edición
 * en el panel, no un despliegue.
 */
export interface VentajaError {
  icono?: string;
  titulo: string;
  texto?: string;
}

interface Props {
  kicker?: string;
  numero?: string;
  titulo?: string;
  texto?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
  imagen?: string;
  imagen_alt?: string;
  ventajas?: VentajaError[];
  variante?: string;
}

const VARIANTES = ["ilustrada"] as const;

export function PaginaNoEncontrada({
  kicker = "Página no encontrada",
  numero = "404",
  titulo = "",
  texto = "",
  cta_texto = "",
  cta_href = "/",
  cta2_texto = "",
  cta2_href = "/tienda",
  imagen = "",
  imagen_alt = "",
  ventajas = [],
  variante,
}: Props) {
  const clase = claseDeVariante(variante, VARIANTES, "error-404", "ilustrada");
  const conImagen = clase.endsWith("ilustrada") && Boolean(imagen);

  return (
    <section className={`error-404 ${clase} ${conImagen ? "" : "error-404--sin-imagen"}`}>
      <div className="error-404-cuerpo">
        <div className="error-404-texto">
          {kicker && <span className="error-404-kicker">{kicker}</span>}

          <p className="error-404-numero" aria-hidden="true">
            {numero}
          </p>

          {titulo && <h1>{titulo}</h1>}
          {texto && <p className="error-404-desc">{texto}</p>}

          {(cta_texto || cta2_texto) && (
            <div className="error-404-acciones">
              {cta_texto && (
                <Link className="btn btn-verde" href={cta_href || "/"}>
                  {cta_texto}
                </Link>
              )}
              {cta2_texto && (
                <Link className="error-404-link" href={cta2_href || "/tienda"}>
                  {cta2_texto}
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
        </div>

        {conImagen && (
          <div className="error-404-media">
            {/* `img` y no `next/image`: la imagen la sube cada negocio a su
                bucket, igual que en `Portada`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen} alt={imagen_alt} />
          </div>
        )}
      </div>

      {ventajas.length > 0 && (
        <ul className="error-404-ventajas">
          {ventajas.map((v, i) => {
            const Icono = icono(v.icono);
            return (
              <li key={`${v.titulo}-${i}`}>
                <span className="error-404-ventaja-icono" aria-hidden="true">
                  <Icono size={18} strokeWidth={2} />
                </span>
                <span>
                  <strong>{v.titulo}</strong>
                  {v.texto && <em>{v.texto}</em>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
