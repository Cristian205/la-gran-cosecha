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
import { obtenerCategorias, obtenerLegal } from "@/lib/datos";
import { resolverDatos } from "@/lib/legal/datos";
import { ENLACES_LEGALES } from "@/lib/legal/enlaces";
import type { LegalGuardado } from "@/lib/legal/tipos";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES } from "@/lib/navegacion";
import type { EnlaceCabecera } from "@/componentes/Navbar";
import type { Categoria } from "@/lib/tipos";
import { telHref, whatsappHref } from "@/lib/utiles";
import { claseDeVariante } from "@/bloques/Seccion";
import { TikTokIcon } from "@/componentes/icons/TikTokIcon";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { WhatsAppLineaIcon } from "@/componentes/icons/WhatsAppLineaIcon";
import { Reveal } from "@/componentes/animacion";

/** Cuántas categorías caben en la columna "Compra" sin volverla un índice. */
const MAX_CATEGORIAS_FOOTER = 4;

/** Un solo trazo para todos los íconos del pie: el de lucide por defecto (2)
 *  se ve grueso a 15-16px sobre fondo oscuro. */
const TRAZO = 1.75;

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
        <Plus size={18} strokeWidth={TRAZO} className={abierto ? "girado" : ""} aria-hidden="true" />
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
  /** Frase institucional corta bajo el nombre, junto al logo («Abastecimiento
   *  confiable para negocios.»). Discreta: firma la marca, no la explica.
   *  Vacía no se dibuja. */
  firma?: string;
  /** El reclamo corto y en negrita bajo el logo («Abastecemos negocios que no
   *  pueden parar.»). Opcional: sin él, la columna de marca se ve como
   *  siempre —logo, nombre y `lema`— y ninguna tienda existente lo nota. */
  tagline?: string;
  lema?: string;
  /** Una línea de info suelta bajo el lema («Entregas para negocios»), con
   *  un camión al lado. Opt-in a propósito: no todas las tiendas reparten. */
  entrega_texto?: string;
  ayuda_titulo?: string;
  /** Texto bajo el título de contacto. Vacío no se dibuja: con el botón de
   *  WhatsApp debajo, a veces sobra. */
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
  /** La columna «Información legal» y la línea de identificación del
   *  comercio (razón social, NIT, dirección, contacto). Encendida por
   *  defecto: un comercio en línea en Colombia debe identificarse. */
  mostrar_legal?: boolean;
  legal_titulo?: string;
  /** Título del segundo grupo de la columna legal: envíos, devoluciones,
   *  retracto, pagos y PQRS. */
  soporte_titulo?: string;
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
 * La jerarquía es deliberada y va de más a menos: marca, las dos acciones
 * (tienda y WhatsApp), títulos de columna, enlaces, identificación del
 * comercio y copyright. Cada nivel baja de peso o de contraste respecto al
 * anterior, para que el pie se lea como la firma de la marca y no como una
 * lista de enlaces.
 *
 * Sin propiedades se ve exactamente como antes.
 */
export function Footer({
  mostrar_cta = true,
  cta_titulo = "¿Listo para hacer tu pedido?",
  cta_texto = "Productos frescos directamente para tu negocio, en minutos.",
  cta_boton = "Explorar productos",
  cta_href = "/tienda",
  firma = "",
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
  mostrar_legal = true,
  legal_titulo = "Información legal",
  soporte_titulo = "Ayuda",
  variante,
}: Props = {}) {
  const { config } = useSiteConfig();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [legal, setLegal] = useState<LegalGuardado | null>(null);

  useEffect(() => {
    // Comparte la petición cacheada con la tienda y el buscador (api/catalog).
    obtenerCategorias().then(setCategorias).catch(() => undefined);
    if (mostrar_legal) obtenerLegal().then(setLegal);
  }, [mostrar_legal]);

  // La identificación del comercio: lo diligenciado en el centro legal y, si
  // falta, lo que ya está en la configuración (el NIT de la factura, el
  // correo…). En el pie solo va lo que existe: un «[NIT por completar]» en
  // cada página de la tienda sería ruido; las políticas sí lo marcan.
  const identidad = resolverDatos(config, legal, "");
  const lineaLegal = [
    identidad.empresa.razon_social,
    identidad.empresa.nit && `NIT ${identidad.empresa.nit}`,
    identidad.empresa.direccion,
    identidad.empresa.ciudad,
  ].filter(Boolean) as string[];
  const correoLegal = identidad.contacto.correo_atencion;
  const telefonoLegal = identidad.contacto.telefono;

  // El nombre del negocio, con un respaldo neutro: este componente lo comparten
  // todas las tiendas y no puede llevar el de ninguna dentro.
  const nombre = config.nombre_empresa || "la tienda";

  const menu: EnlaceCabecera[] =
    enlaces && enlaces.length > 0
      ? enlaces
      : ENLACES.map((e) => ({ texto: e.label, href: e.to, exacto: e.fin }));

  const enlacesLegales = ENLACES_LEGALES.filter((e) => e.grupo === "legal");
  const enlacesSoporte = ENLACES_LEGALES.filter((e) => e.grupo === "ayuda");

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

      <div className={`footer-top ${mostrar_legal && !minimo ? "footer-top--con-legal" : ""}`}>
        <div className="footer-marca-col">
          <div className="footer-marca">
            <span className={`footer-logo ${config.logo_url ? "" : "footer-logo--letra"}`}>
              {config.logo_url ? (
                <img src={config.logo_url} alt="" />
              ) : (
                nombre.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="footer-marca-texto">
              <span className="footer-marca-nombre">{nombre}</span>
              {firma && <span className="footer-firma">{firma}</span>}
            </span>
          </div>
          {tagline && <p className="footer-tagline">{tagline}</p>}
          <p className="footer-lema">
            {lema ||
              config.mision ||
              "Haz tu pedido en línea y recíbelo donde lo necesites."}
          </p>
          {(entrega_texto || config.ciudad) && (
            <ul className="footer-info-lineas">
              {entrega_texto && (
                <li className="footer-info-linea">
                  <Truck size={15} strokeWidth={TRAZO} aria-hidden="true" /> {entrega_texto}
                </li>
              )}
              {config.ciudad && (
                <li className="footer-info-linea">
                  <MapPin size={15} strokeWidth={TRAZO} aria-hidden="true" /> {config.ciudad}
                </li>
              )}
            </ul>
          )}
          <Link href="/tienda" className="footer-btn-tienda">
            Explorar tienda
            <span className="footer-btn-tienda-flecha" aria-hidden="true">
              <ArrowRight size={14} strokeWidth={2} />
            </span>
          </Link>
          {hayRedes && (
            <div className="footer-redes">
              {config.instagram_url && (
                <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={17} strokeWidth={TRAZO} />
                </a>
              )}
              {config.facebook_url && (
                <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={17} strokeWidth={TRAZO} />
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

        {/* Contacto: en móvil va justo tras la marca, no al final. WhatsApp es
            la acción; el resto son datos y se leen como texto, no como
            botones. */}
        <div className="footer-col footer-ayuda">
          <h4>{ayuda_titulo}</h4>
          {ayuda_texto && <p className="footer-ayuda-texto">{ayuda_texto}</p>}
          {hrefWhatsapp && (
            <a
              className="footer-btn-wsp"
              href={hrefWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppLineaIcon size={18} /> Hablar por WhatsApp
            </a>
          )}
          <ul className="footer-contacto">
            {config.telefono && (
              <li>
                <a href={telHref(config.telefono)} className="footer-contacto-item">
                  <Phone size={15} strokeWidth={TRAZO} aria-hidden="true" />
                  {config.telefono}
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
            {config.ciudad && (
              <li className="footer-contacto-item">
                <MapPin size={15} strokeWidth={TRAZO} aria-hidden="true" />
                {config.ciudad}
              </li>
            )}
            {config.horario && (
              <li className="footer-contacto-item">
                <Clock size={15} strokeWidth={TRAZO} aria-hidden="true" />
                {config.horario}
              </li>
            )}
          </ul>
        </div>

        {/* Solo categorías reales del catálogo: nada de enlaces inventados. */}
        {!minimo && (
        <ColumnaFooter titulo={compra_titulo}>
          <Link href="/tienda" className="footer-enlace-principal">
            Ver catálogo <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
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

        {/* Las nueve páginas legales en dos grupos que comparten columna en
            escritorio y son dos acordeones en móvil. */}
        {mostrar_legal && !minimo && (
          <div className="footer-col-grupo">
            <ColumnaFooter titulo={legal_titulo}>
              {enlacesLegales.map((e) => (
                <Link key={e.href} href={e.href}>
                  {e.texto}
                </Link>
              ))}
            </ColumnaFooter>
            <ColumnaFooter titulo={soporte_titulo}>
              {enlacesSoporte.map((e) => (
                <Link key={e.href} href={e.href}>
                  {e.texto}
                </Link>
              ))}
            </ColumnaFooter>
          </div>
        )}
      </div>

      {/* Barra institucional: quién vende (izquierda) y cómo encontrarlo
          (derecha). Una línea de datos, no otro bloque de contenido. */}
      {mostrar_legal && (lineaLegal.length > 0 || correoLegal || telefonoLegal) && (
        <div className="footer-identidad">
          {lineaLegal.length > 0 && (
            <p className="footer-identidad-datos">
              {lineaLegal.map((dato, i) => (
                <span key={i} className={i === 0 ? "footer-identidad-nombre" : undefined}>
                  {dato}
                </span>
              ))}
            </p>
          )}
          {(correoLegal || telefonoLegal) && (
            <p className="footer-identidad-datos footer-identidad-contacto">
              {correoLegal && (
                <span>
                  <a href={`mailto:${correoLegal}`}>{correoLegal}</a>
                </span>
              )}
              {telefonoLegal && (
                <span>
                  <a href={telHref(telefonoLegal)}>{telefonoLegal}</a>
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div className="footer-bottom">
        <span className="footer-copyright">
          © {new Date().getFullYear()} {nombre} — {nota_legal || "Todos los derechos reservados"}
        </span>
        {/* En el pie mínimo no hay columna: los enlaces legales van aquí,
            todos, porque son los que no se pueden quitar. */}
        {mostrar_legal && minimo ? (
          <nav className="footer-legal" aria-label={legal_titulo}>
            {ENLACES_LEGALES.map((e) => (
              <Link key={e.href} href={e.href}>
                {e.texto}
              </Link>
            ))}
          </nav>
        ) : (
          (privacidad_href || terminos_href) && (
            <nav className="footer-legal" aria-label="Legal">
              {privacidad_href && <Link href={privacidad_href}>{privacidad_texto}</Link>}
              {terminos_href && <Link href={terminos_href}>{terminos_texto}</Link>}
            </nav>
          )
        )}
      </div>
    </footer>
  );
}
