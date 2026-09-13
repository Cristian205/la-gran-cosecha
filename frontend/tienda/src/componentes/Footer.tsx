"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Plus,
  Truck,
} from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { obtenerCategorias } from "@/lib/datos";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES } from "@/lib/navegacion";
import type { EnlaceCabecera } from "@/componentes/Navbar";
import type { Categoria } from "@/lib/tipos";
import { telHref, whatsappHref } from "@/lib/utiles";
import { claseDeVariante } from "@/bloques/Seccion";
import { TikTokIcon } from "@/componentes/icons/TikTokIcon";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { Reveal } from "@/componentes/animacion";

/** Cuántas categorías caben en la columna "Compra" sin volverla un índice. */
const MAX_CATEGORIAS_FOOTER = 4;

/**
 * Los dos pies que esta hoja sabe dibujar.
 *
 * `columnas` es el de siempre: marca, contacto y dos columnas de enlaces.
 * `minimo` es una sola fila —marca, menú y aviso legal— y existe porque una
 * boutique con ocho productos no tiene doce enlaces que poner, y un pie de
 * cuatro columnas medio vacías se ve peor que uno corto.
 *
 * No es CSS que esconde lo que sobra: en `minimo` las columnas NO se pintan.
 * Ocultarlas dejaría el marcado dentro —peso y ruido para el rastreador— para
 * enseñar algo que el negocio dijo que no quería.
 */
const VARIANTES = ["columnas", "minimo"] as const;

/**
 * Columna del pie: lista abierta en escritorio y acordeón en móvil, donde
 * apilar todas las columnas abiertas hacía un pie larguísimo justo encima del
 * carrito y la barra de navegación. El panel siempre está en el DOM; quién lo
 * muestra es el CSS según el ancho, así el escritorio nunca depende del estado.
 */
function ColumnaFooter({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();

  return (
    <div className="footer-col">
      <h4>{titulo}</h4>
      <button
        type="button"
        className="footer-col-toggle"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{titulo}</span>
        <Plus size={18} className={abierto ? "girado" : ""} aria-hidden="true" />
      </button>
      <div id={idPanel} className={`footer-col-panel ${abierto ? "abierto" : ""}`}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  mostrar_cta?: boolean;
  cta_titulo?: string;
  cta_texto?: string;
  cta_boton?: string;
  cta_href?: string;
  /** El reclamo corto y en negrita bajo el logo («Abastecemos negocios que no
   *  pueden parar.»). Opcional: sin él, la columna de marca se ve como
   *  siempre —logo, nombre y `lema`— y ninguna tienda existente lo nota. */
  tagline?: string;
  lema?: string;
  /** Una línea de info suelta bajo el lema («Entregas para negocios»), con
   *  un camión al lado. Opt-in a propósito: no todas las tiendas reparten. */
  entrega_texto?: string;
  ayuda_titulo?: string;
  ayuda_texto?: string;
  compra_titulo?: string;
  mostrar_categorias?: boolean;
  max_categorias?: number;
  navegacion_titulo?: string;
  enlaces?: EnlaceCabecera[];
  mostrar_redes?: boolean;
  nota_legal?: string;
  /** Los dos enlaces legales de la barra inferior. Sin `href` no se dibujan
   *  — un enlace a una página que el negocio no ha escrito todavía es peor
   *  que no tenerlo. */
  privacidad_href?: string;
  privacidad_texto?: string;
  terminos_href?: string;
  terminos_texto?: string;
  variante?: string;
}

/**
 * El pie de la tienda. Es tambien el bloque «pie».
 *
 * Como la cabecera: se le anadieron propiedades en vez de escribir un pie
 * nuevo. Aqui pesa aun mas, porque el pie tiene acordeon en movil, columna de
 * categorias que se pide al catalogo y cuatro formas de contacto — todo eso ya
 * resuelto y probado.
 *
 * Los DATOS de contacto siguen saliendo de la configuracion del negocio
 * (telefono, correo, redes, horario) y no de las propiedades. Es su identidad,
 * no la maqueta de una pagina: duplicarlos daria dos sitios donde cambiar el
 * telefono, y el segundo se quedaria viejo. Lo que si es propiedad del bloque
 * son los TEXTOS y que columnas se muestran.
 *
 * Sin propiedades se ve exactamente como antes.
 */
export function Footer({
  mostrar_cta = true,
  cta_titulo = "¿Listo para hacer tu pedido?",
  cta_texto = "Productos frescos directamente para tu negocio, en minutos.",
  cta_boton = "Explorar productos",
  cta_href = "/tienda",
  tagline = "",
  lema = "",
  entrega_texto = "",
  ayuda_titulo = "¿Necesitas ayuda?",
  ayuda_texto = "Escríbenos y te acompañamos con tu pedido.",
  compra_titulo = "Compra",
  mostrar_categorias = true,
  max_categorias = MAX_CATEGORIAS_FOOTER,
  navegacion_titulo = "Navegación",
  enlaces,
  mostrar_redes = true,
  nota_legal = "",
  privacidad_href = "",
  privacidad_texto = "Política de privacidad",
  terminos_href = "",
  terminos_texto = "Términos y condiciones",
  variante,
}: Props = {}) {
  const { config } = useSiteConfig();
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    // Comparte la petición cacheada con la tienda y el buscador (api/catalog).
    obtenerCategorias().then(setCategorias).catch(() => undefined);
  }, []);

  // El nombre del negocio, con un respaldo neutro: este componente lo comparten
  // todas las tiendas y no puede llevar el de ninguna dentro.
  const nombre = config.nombre_empresa || "la tienda";

  const menu: EnlaceCabecera[] =
    enlaces && enlaces.length > 0
      ? enlaces
      : ENLACES.map((e) => ({ texto: e.label, href: e.to, exacto: e.fin }));

  const hayRedes = mostrar_redes && Boolean(
    config.instagram_url || config.facebook_url || config.tiktok_url
  );
  const hrefWhatsapp = config.whatsapp_numero
    ? whatsappHref(
        config.whatsapp_numero,
        `Hola, quiero hacer un pedido con ${nombre}.`
      )
    : null;

  const clase = claseDeVariante(variante, VARIANTES, "footer", "columnas");
  const minimo = clase === "footer--minimo";

  return (
    <footer className={`footer ${clase}`}>
      {/* Última oportunidad de conversión antes de cerrar la página. El pie
          mínimo no la lleva: si el negocio eligió un pie corto, rematarlo con
          una franja de conversión lo deja igual de largo que el otro. */}
      {mostrar_cta && !minimo && (
      <Reveal as="section" className="footer-cta">
        <div className="footer-cta-inner">
          <div>
            <h2>{cta_titulo}</h2>
            <p>{cta_texto}</p>
          </div>
          <div className="footer-cta-acciones">
            <Link href={cta_href || "/tienda"} className="btn btn-ambar">
              {cta_boton} <ArrowRight size={17} />
            </Link>
            {hrefWhatsapp && (
              <a
                className="btn btn-whatsapp"
                href={hrefWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={18} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </Reveal>
      )}

      <div className="footer-top">
        <div className="footer-marca-col">
          <div className="footer-marca">
            <span className="logo-circ" style={{ width: 44, height: 44 }}>
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={nombre}
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
                />
              ) : (
                nombre.slice(0, 1).toUpperCase()
              )}
            </span>
            {nombre}
          </div>
          {tagline && <p className="footer-tagline">{tagline}</p>}
          <p className="footer-lema">
            {lema ||
              config.mision ||
              "Haz tu pedido en línea y recíbelo donde lo necesites."}
          </p>
          {(entrega_texto || config.ciudad) && (
            <div className="footer-info-lineas">
              {entrega_texto && (
                <span className="footer-info-linea">
                  <Truck size={15} /> {entrega_texto}
                </span>
              )}
              {config.ciudad && (
                <span className="footer-info-linea">
                  <MapPin size={15} /> {config.ciudad}
                </span>
              )}
            </div>
          )}
          <Link href="/tienda" className="footer-btn-tienda">
            Explorar tienda <ArrowRight size={15} />
          </Link>
          {hayRedes && (
            <div className="footer-redes">
              {config.instagram_url && (
                <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={17} />
                </a>
              )}
              {config.facebook_url && (
                <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={17} />
                </a>
              )}
              {config.tiktok_url && (
                <a href={config.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <TikTokIcon size={16} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Ayuda: en móvil va justo tras la marca (orden CSS), no al final. */}
        <div className="footer-col footer-ayuda">
          <h4>{ayuda_titulo}</h4>
          <p className="footer-ayuda-texto">{ayuda_texto}</p>
          {hrefWhatsapp && (
            <a
              className="footer-btn-wsp"
              href={hrefWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={17} /> Hablar por WhatsApp
            </a>
          )}
          <div className="footer-col-panel abierto footer-contacto-chips">
            {config.telefono && (
              <a href={telHref(config.telefono)} className="footer-contacto-item">
                <span className="footer-contacto-icono"><Phone size={14} /></span>
                {config.telefono}
              </a>
            )}
            {config.email && (
              <a href={`mailto:${config.email}`} className="footer-contacto-item">
                <span className="footer-contacto-icono"><Mail size={14} /></span>
                {config.email}
              </a>
            )}
            {config.ciudad && (
              <span className="footer-contacto-item footer-contacto-item--estatico">
                <span className="footer-contacto-icono"><MapPin size={14} /></span>
                {config.ciudad}
              </span>
            )}
            {config.horario && (
              <span className="footer-contacto-item footer-contacto-item--estatico">
                <span className="footer-contacto-icono"><Clock size={14} /></span>
                {config.horario}
              </span>
            )}
          </div>
        </div>

        {/* Solo categorías reales del catálogo: nada de enlaces inventados. */}
        {!minimo && (
        <ColumnaFooter titulo={compra_titulo}>
          <Link href="/tienda">Ver catálogo</Link>
          {mostrar_categorias &&
            categorias.slice(0, max_categorias).map((c) => (
              <Link key={c.id} href={`/tienda?categoria=${c.id}`}>
                {c.nombre_categoria}
              </Link>
            ))}
          <Link href="/tienda/pedido">Mi pedido</Link>
        </ColumnaFooter>
        )}

        {/* En el pie mínimo el menú no es una columna sino una fila suelta: es
            lo único que sobrevive del bloque de enlaces. */}
        {minimo ? (
          <nav className="footer-menu-min">
            {menu.map((e) => (
              <Link key={`${e.href}-${e.texto}`} href={e.href}>
                {e.texto}
              </Link>
            ))}
          </nav>
        ) : (
          <ColumnaFooter titulo={navegacion_titulo}>
            {menu.map((e) => (
              <Link key={`${e.href}-${e.texto}`} href={e.href}>
                {e.texto}
              </Link>
            ))}
          </ColumnaFooter>
        )}
      </div>

      <div className="footer-bottom">
        <span className="footer-copyright">
          © {new Date().getFullYear()} {nombre} — {nota_legal || "Todos los derechos reservados"}
        </span>
        {(privacidad_href || terminos_href) && (
          <nav className="footer-legal" aria-label="Legal">
            {privacidad_href && <Link href={privacidad_href}>{privacidad_texto}</Link>}
            {terminos_href && <Link href={terminos_href}>{terminos_texto}</Link>}
          </nav>
        )}
      </div>
    </footer>
  );
}
