import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * La portada: lo primero que ve quien llega.
 *
 * Es un bloque de CONTENIDO y no de catálogo: no pide productos, los textos son
 * suyos. Eso lo hace la pieza más reutilizable del motor —una ferretería y una
 * perfumería usan la misma con otras palabras y otra foto— y por eso vale la
 * pena que sea configurable hasta el último renglón.
 *
 * Se distingue de `carrusel-promociones`, que ya existía, en lo que promete:
 * el carrusel enseña BANDEROLAS que el negocio carga y rota; esta portada
 * enseña UNA propuesta fija. Un negocio elige una de las dos, no las dos —y por
 * eso las dos son `unico_por_pagina`.
 *
 * `titulo_resaltado` va aparte del título en vez de admitir marcado dentro del
 * texto. Guardar HTML en una propiedad convertiría el constructor en un editor
 * de código y abriría la puerta a que un texto rompa la maqueta; con dos campos,
 * el énfasis es una decisión de diseño que el tema controla.
 */
export interface Ventaja {
  icono?: string;
  titulo: string;
  /** Una segunda linea bajo el titulo. La trajo la plantilla de boutique, que
   *  promete «Envios rapidos / A todo el pais» en dos alturas. Opcional: sin
   *  ella la ventaja se dibuja como siempre, en una sola linea. */
  texto?: string;
}

interface Props {
  kicker?: string;
  /** El icono del antetitulo. Era una hoja escrita a mano en el componente, lo
   *  cual ataba la portada de CUALQUIER tienda a la identidad de una
   *  distribuidora de alimentos. Ahora lo nombra el dato. */
  kicker_icono?: string;
  /** Que dibujo lleva el boton principal: `carrito` o `flecha`. Una boutique
   *  no pone un carrito en «Comprar ahora»; una distribuidora si. */
  cta_icono?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  cta_texto?: string;
  cta_href?: string;
  cta2_texto?: string;
  cta2_href?: string;
  ventajas?: Ventaja[];
  imagen?: string;
  imagen_alt?: string;
  tarjeta_titulo?: string;
  tarjeta_texto?: string;
  tarjeta_icono?: string;
  variante?: string;
}

const VARIANTES = ["imagen", "centrado", "boutique"] as const;

export function Portada({
  kicker = "",
  kicker_icono = "hoja",
  cta_icono = "carrito",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  cta_texto = "",
  cta_href = "/tienda",
  cta2_texto = "",
  cta2_href = "/tienda",
  ventajas = [],
  imagen = "",
  imagen_alt = "",
  tarjeta_titulo = "",
  tarjeta_texto = "",
  tarjeta_icono = "reloj",
  variante,
}: Props) {
  // Sin titular no hay portada. Un hero vacío ocupa media pantalla y parece que
  // algo falló al cargar, que es peor que no tenerlo.
  if (!titulo && !titulo_resaltado) return null;

  const IconoTarjeta = icono(tarjeta_icono);
  const IconoKicker = icono(kicker_icono);
  const IconoCta = cta_icono === "flecha" ? ArrowRight : ShoppingCart;
  const clase = claseDeVariante(variante, VARIANTES, "portada", "imagen");
  // Sin foto, las variantes que reservan media portada la dejarían en blanco.
  const conImagen =
    (clase.endsWith("imagen") || clase.endsWith("boutique")) && Boolean(imagen);

  return (
    <section className={`portada ${clase} ${conImagen ? "" : "portada--sin-imagen"}`}>
      <div className="portada-cuerpo">
        {kicker && (
          <span className="portada-kicker">
            <IconoKicker size={15} aria-hidden="true" />
            {kicker}
          </span>
        )}

        <h1>
          {titulo}
          {titulo_resaltado && (
            <>
              {titulo && " "}
              <em>{titulo_resaltado}</em>
            </>
          )}
        </h1>

        {texto && <p className="portada-texto">{texto}</p>}

        {(cta_texto || cta2_texto) && (
          <div className="portada-acciones">
            {cta_texto && (
              <Link className="btn primario" href={cta_href || "/tienda"}>
                {cta_icono === "flecha" ? (
                  <>
                    {cta_texto}
                    <IconoCta size={17} />
                  </>
                ) : (
                  <>
                    <IconoCta size={17} />
                    {cta_texto}
                  </>
                )}
              </Link>
            )}
            {cta2_texto && (
              <Link className="btn secundario" href={cta2_href || "/tienda"}>
                {cta2_texto}
              </Link>
            )}
          </div>
        )}

        {ventajas.length > 0 && (
          <ul className="portada-ventajas">
            {ventajas.map((v, i) => {
              const Icono = icono(v.icono);
              return (
                <li key={`${v.titulo}-${i}`}>
                  <Icono size={17} aria-hidden="true" />
                  <span>
                    {v.titulo}
                    {v.texto && <em>{v.texto}</em>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {conImagen && (
        <div className="portada-media">
          {/* `img` y no `next/image`: la foto la sube cada negocio a su bucket
              y el dominio no se conoce al compilar. Optimizarla exigiría
              declarar los hosts en la configuración de Next, que es lo que
              haría falta tocar cada vez que entra un cliente nuevo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagen} alt={imagen_alt || titulo} />

          {(tarjeta_titulo || tarjeta_texto) && (
            <div className="portada-tarjeta glass">
              <span className="icono" aria-hidden="true">
                <IconoTarjeta size={20} />
              </span>
              <div>
                {tarjeta_titulo && <strong>{tarjeta_titulo}</strong>}
                {tarjeta_texto && <span>{tarjeta_texto}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
