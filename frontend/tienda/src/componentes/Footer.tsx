"use client";

import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { obtenerLegal } from "@/lib/datos";
import { resolverDatos } from "@/lib/legal/datos";
import type { LegalGuardado } from "@/lib/legal/tipos";
import { useSiteConfig } from "@/componentes/CapaCliente";
import type { EnlaceCabecera } from "@/componentes/Navbar";
import { whatsappHref } from "@/lib/utiles";
import { WhatsAppLineaIcon } from "@/componentes/icons/WhatsAppLineaIcon";
import { srcSetImagen } from "@/lib/imagen";
import { claseDeVariante } from "@/bloques/Seccion";

/**
 * `columnas` es el pie aprobado, con la vitrina y la foto del camión: el de
 * por defecto. `minimo` deja solo la franja institucional y el copyright,
 * para las tiendas a las que la vitrina no les corresponde. No es CSS que
 * esconde lo que sobra: en `minimo` la vitrina (y su foto) NO se pinta ni se
 * descarga.
 */
const VARIANTES = ["columnas", "minimo"] as const;

/** Dueña de la plataforma sobre la que corren las tiendas (crédito en el pie). */
const PROPIETARIO_PLATAFORMA = "Crafteech";
const SITIO_PLATAFORMA = "https://crafteech.com";

/** Un solo trazo para todos los íconos del pie. */
const TRAZO = 1.75;

/** La foto de la vitrina: el camión de reparto de la marca en carretera entre
 *  cultivos (panorámica 3:1). Se funde con el verde por la izquierda. */
const CAMION = { grande: "/img/footer/camion-hino.webp", chica: "/img/footer/camion-hino-sm.webp" };

/**
 * Los enlaces de la franja legal, en este orden. Son páginas que ya existen
 * (ver `lib/legal/enlaces.ts`).
 */
const ENLACES_PIE = [
  { href: "/terminos-y-condiciones", texto: "Términos y condiciones" },
  { href: "/politica-de-privacidad", texto: "Privacidad" },
  { href: "/politica-tratamiento-datos", texto: "Tratamiento de datos" },
  { href: "/politica-de-cookies", texto: "Cookies" },
  { href: "/contacto-y-peticiones", texto: "PQRS / Contacto" },
];

/**
 * Propiedades del bloque «pie». Las heredadas del pie de columnas se siguen
 * aceptando para que los bloques ya guardados no fallen, pero se ignoran.
 */
interface Props {
  /** Titular de la vitrina comercial. */
  titular?: string;
  /** Palabra del titular que va resaltada. Vacía: ninguna. */
  titular_resaltado?: string;
  /** Línea corta sobre el titular. Vacía no se dibuja. */
  antetitulo?: string;
  /** Frase corta bajo el nombre, junto al logo. Vacía no se dibuja. */
  firma?: string;
  /** Descripción comercial breve. Sin ella se usa la misión del negocio. */
  lema?: string;
  /** Texto tras el copyright. Por defecto, «Todos los derechos reservados.» */
  nota_legal?: string;
  /** Enlaces legales. Encendidos por defecto. */
  mostrar_legal?: boolean;
  legal_titulo?: string;
  // Heredadas; ya no tienen efecto (el pie no lleva botón).
  mostrar_cta?: boolean;
  cta_boton?: string;
  cta_href?: string;
  cta_titulo?: string;
  cta_texto?: string;
  tagline?: string;
  entrega_texto?: string;
  ayuda_titulo?: string;
  ayuda_texto?: string;
  compra_titulo?: string;
  mostrar_categorias?: boolean;
  max_categorias?: number;
  navegacion_titulo?: string;
  enlaces?: EnlaceCabecera[];
  mostrar_redes?: boolean;
  privacidad_href?: string;
  privacidad_texto?: string;
  terminos_href?: string;
  terminos_texto?: string;
  soporte_titulo?: string;
  /** `columnas` (por defecto, con la vitrina) o `minimo`. */
  variante?: string;
}

/** Envuelve la primera aparición de `palabra` en un <em>. */
function resaltar(texto: string, palabra: string): ReactNode {
  const i = palabra ? texto.toLowerCase().indexOf(palabra.toLowerCase()) : -1;
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <em>{texto.slice(i, i + palabra.length)}</em>
      {texto.slice(i + palabra.length)}
    </>
  );
}

/**
 * El pie de la tienda (también el bloque «pie»): la última pieza publicitaria
 * de la marca antes de cerrar la página.
 *
 *   1. Vitrina: titular y la foto panorámica del camión de reparto de la
 *      marca, a la derecha, fundida con el verde por la izquierda y con
 *      bordes suaves (sin rectángulo rígido).
 *   2. Franja institucional en una fila: marca | contacto | enlaces legales.
 *   3. Copyright y crédito de la plataforma.
 *
 * Los datos de contacto salen de la configuración del negocio y aparecen una
 * sola vez.
 */
export function Footer({
  titular = "Tu negocio merece productos frescos todos los días",
  titular_resaltado = "frescos",
  antetitulo = "Del campo a tu negocio",
  firma = "",
  lema = "",
  nota_legal = "",
  mostrar_legal = true,
  legal_titulo = "Información legal",
  variante,
}: Props = {}) {
  const clase = claseDeVariante(variante, VARIANTES, "footer", "columnas");
  const minimo = clase === "footer--minimo";
  const { config } = useSiteConfig();
  const [legal, setLegal] = useState<LegalGuardado | null>(null);
  const idTitular = useId();

  useEffect(() => {
    if (mostrar_legal) obtenerLegal().then(setLegal);
  }, [mostrar_legal]);

  // El nombre del negocio, con un respaldo neutro: este componente lo comparten
  // todas las tiendas y no puede llevar el de ninguna dentro.
  const nombre = config.nombre_empresa || "la tienda";
  const nit = resolverDatos(config, legal, "").empresa.nit;

  // Una sola línea bajo el nombre: la firma corta del bloque o, sin ella, la
  // descripción (que el CSS corta a una línea si es larga).
  const descripcion =
    firma || lema || config.mision || "Haz tu pedido en línea y recíbelo donde lo necesites.";

  const ubicacion = [config.direccion, config.ciudad].filter(Boolean).join(", ");
  const hrefWhatsapp = config.whatsapp_numero
    ? whatsappHref(config.whatsapp_numero, `Hola, quiero hacer un pedido con ${nombre}.`)
    : null;
  const hayContacto = Boolean(hrefWhatsapp || config.email || ubicacion);

  return (
    <footer className={`footer ${clase}`}>
      {/* 1. Vitrina comercial (no va en el pie mínimo) */}
      {!minimo && (
      <section className="footer-vitrina" aria-labelledby={idTitular}>
        <div className="footer-vitrina-texto">
          {antetitulo && <p className="footer-vitrina-antetitulo">{antetitulo}</p>}
          <h2 id={idTitular} className="footer-vitrina-titular">
            {resaltar(titular, titular_resaltado)}
          </h2>
        </div>

        <div className="footer-vitrina-visual" aria-hidden="true">
          <img
            className="footer-vitrina-foto"
            src={CAMION.grande}
            srcSet={`${CAMION.chica} 900w, ${CAMION.grande} 1600w`}
            sizes="(max-width: 780px) 100vw, 66vw"
            width={1600}
            height={533}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Filo dorado ondulado que separa la vitrina de la franja
            institucional. */}
        <svg className="footer-vitrina-filo" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${idTitular}-oro`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#f5c542" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#e3a62f" stopOpacity="0.85" />
              <stop offset="1" stopColor="#8fd16a" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path d="M0 30C260 6 520 2 780 16s470 22 660 4" fill="none" stroke={`url(#${idTitular}-oro)`} strokeWidth="2.5" />
        </svg>
      </section>
      )}

      {/* 2. Franja institucional */}
      <div className="footer-institucional">
        <div className="footer-marca-bloque">
          <span className={`footer-logo ${config.logo_url ? "" : "footer-logo--letra"}`}>
            {config.logo_url ? (
              <img src={config.logo_url} srcSet={srcSetImagen(config.logo_url, [96, 128, 256])} sizes="64px" alt="" />
            ) : (
              nombre.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="footer-marca-texto">
            <span className="footer-marca-nombre">{nombre}</span>
            <p className="footer-lema" title={descripcion}>{descripcion}</p>
          </div>
        </div>

        {hayContacto && (
          <ul className="footer-contacto" aria-label="Contacto">
            {hrefWhatsapp && (
              <li>
                <a href={hrefWhatsapp} target="_blank" rel="noopener noreferrer" className="footer-contacto-item">
                  <WhatsAppLineaIcon size={15} />
                  {config.whatsapp_numero}
                </a>
              </li>
            )}
            {config.email && (
              <li>
                <a href={`mailto:${config.email}`} className="footer-contacto-item">
                  <Mail size={15} strokeWidth={TRAZO} aria-hidden="true" />
                  {config.email}
                </a>
              </li>
            )}
            {ubicacion && (
              <li className="footer-contacto-item">
                <MapPin size={15} strokeWidth={TRAZO} aria-hidden="true" />
                {ubicacion}
              </li>
            )}
          </ul>
        )}
        {mostrar_legal && (
          <nav className="footer-legal" aria-label={legal_titulo}>
            {ENLACES_PIE.map((e) => (
              <Link key={e.href} href={e.href}>
                {e.texto}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* 3. Franja inferior */}
      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} {nombre}
          {mostrar_legal && nit ? ` · NIT ${nit}` : ""}. {nota_legal || "Todos los derechos reservados."}
        </p>
        <p className="footer-credito">
          Desarrollado por{" "}
          <a href={SITIO_PLATAFORMA} target="_blank" rel="noopener">
            <strong>{PROPIETARIO_PLATAFORMA}</strong>
          </a>
        </p>
      </div>
    </footer>
  );
}
