"use client";

import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Reveal } from "@/componentes/animacion";
import { obtenerProductos } from "@/lib/datos";
import { formatoPrecio } from "@/lib/utiles";
import { claseDeVariante } from "../Seccion";
import { Boton, TipografiaEditorial } from "./comunes";

/**
 * Composición editorial: fotografía alta a un lado, texto con una palabra en
 * serif cursiva, precio y un solo botón. Es la campaña "de revista", la que
 * cuenta un producto en lugar de mostrarlo.
 *
 * El precio no se escribe a mano: con `producto_slug` se lee del catálogo en
 * vivo ("Desde", porque el precio del día cambia — ver AvisoPrecios), y si el
 * producto no existe la línea sencillamente no aparece. `precio_texto` permite
 * una leyenda manual para campañas que no son un producto ("2x1 este sábado").
 */
interface Props {
  kicker?: string;
  titulo?: string;
  titulo_resaltado?: string;
  texto?: string;
  imagen?: string;
  imagen_alt?: string;
  enfoque?: string;
  producto_slug?: string;
  precio_texto?: string;
  cta_texto?: string;
  cta_href?: string;
  variante?: string;
}

const VARIANTES = ["imagen-izquierda", "imagen-derecha"] as const;

export function EditorialCampaign({
  kicker = "",
  titulo = "",
  titulo_resaltado = "",
  texto = "",
  imagen = "",
  imagen_alt = "",
  enfoque = "50% 50%",
  producto_slug = "",
  precio_texto = "",
  cta_texto = "",
  cta_href = "",
  variante,
}: Props) {
  const [precioVivo, setPrecioVivo] = useState("");

  useEffect(() => {
    if (!producto_slug) return;
    let vigente = true;
    obtenerProductos({ slug: producto_slug, pageSize: 1 })
      .then((pagina) => {
        const valor = pagina.results[0]?.precio_desde;
        if (vigente && valor) setPrecioVivo(formatoPrecio(valor));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [producto_slug]);

  if (!titulo) return null;

  const clase = claseDeVariante(variante, VARIANTES, "ec", "imagen-izquierda");
  const destino = cta_href || (producto_slug ? `/productos/${producto_slug}` : "/tienda");
  const precio = precio_texto || (precioVivo ? `Desde ${precioVivo}` : "");

  return (
    <section className={`ec ${clase}`} style={{ "--enfoque": enfoque } as CSSProperties}>
      <TipografiaEditorial />
      <div className="cmp-inner ec-grid">
        {/* Disparador en el marco, recorte en el hijo: ver ProductSpotlight. */}
        <motion.div
          className="ec-foto"
          initial="oculto"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={{ oculto: {}, visible: {} }}
        >
          <motion.div
            className="ec-foto-recorte"
            variants={{ oculto: { clipPath: "inset(0 0 100% 0)" }, visible: { clipPath: "inset(0 0 0% 0)" } }}
            transition={{ duration: 1, ease: [0.77, 0, 0.175, 1] }}
          >
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen} alt={imagen_alt} loading="lazy" decoding="async" />
            ) : (
              <div className="ec-marcador" aria-hidden="true" />
            )}
          </motion.div>
        </motion.div>

        <div className="ec-texto">
          {kicker && (
            <Reveal>
              <p className="cmp-kicker">{kicker}</p>
            </Reveal>
          )}
          <Reveal retraso={0.08}>
            <h2>
              {titulo}
              {titulo_resaltado && <em>{titulo_resaltado}</em>}
            </h2>
          </Reveal>
          {texto && (
            <Reveal retraso={0.16}>
              <p className="ec-parrafo">{texto}</p>
            </Reveal>
          )}
          <Reveal retraso={0.24} className="ec-cierre">
            {precio && (
              <p className="ec-precio">
                <strong>{precio}</strong>
                {precioVivo && !precio_texto && <span>precio aproximado</span>}
              </p>
            )}
            {cta_texto && <Boton href={destino} variante="oscuro">{cta_texto}</Boton>}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
