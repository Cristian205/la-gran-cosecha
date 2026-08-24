import {
  ArrowDown,
  ArrowRight,
  Heart,
  Leaf,
  ShieldCheck,
  Sprout,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroNosotros from "../assets/hero-nosotros.webp";
import lineaProcesos from "../assets/linea-procesos.webp";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useResaltarAlLlegar } from "../hooks/useResaltarAlLlegar";

const VALORES = [
  {
    icono: "leaf" as const,
    titulo: "Frescura garantizada",
    texto: "Seleccionamos cada producto a mano para asegurar la mejor calidad en tu pedido.",
  },
  {
    icono: "truck" as const,
    titulo: "Entrega confiable",
    texto: "Cumplimos los tiempos acordados para que tu negocio nunca se quede sin inventario.",
  },
  {
    icono: "heart" as const,
    titulo: "Trato cercano",
    texto: "Hablamos tu mismo idioma: te asesoramos para armar el pedido que realmente necesitas.",
  },
  {
    icono: "users" as const,
    titulo: "Compromiso local",
    texto: "Trabajamos de la mano con productores de la región para fortalecer la economía local.",
  },
];

/**
 * Los mismos tres pasos que ilustra `linea-procesos.webp`. En móvil la
 * ilustración baja de ~620 a ~356 px y sus etiquetas quedan ilegibles, así que
 * ahí se muestra esta versión en texto, que se lee a cualquier ancho.
 */
const RUTA = [
  { icono: Sprout, texto: "Campo" },
  { icono: Truck, texto: "Logística" },
  { icono: Store, texto: "Tu negocio" },
];

const ICONOS: Record<(typeof VALORES)[number]["icono"], LucideIcon> = {
  leaf: Leaf,
  truck: Truck,
  heart: Heart,
  users: Users,
};

export function AboutPage() {
  const { config } = useSiteConfig();
  useResaltarAlLlegar(config);

  // La sección de historia solo existe si hay contenido cargado desde el panel;
  // si no, el CTA lleva a la sección que siempre está presente.
  const anclaHistoria = config.historia || config.mision ? "historia-mision" : "valores";

  return (
    <div>
      <section className="hero-nosotros">
        <img
          className="hero-nosotros-fondo"
          src={heroNosotros}
          alt=""
          aria-hidden="true"
          decoding="async"
        />

        {/* Tarjeta de vidrio: separa el mensaje del paisaje sin taparlo. */}
        <div className="hero-nosotros-panel">
          <span className="etiqueta glass-dark">
            <ShieldCheck size={15} /> Garantía de frescura
          </span>
          <h1>
            Del campo colombiano <em>a tu negocio</em>
          </h1>
          <p>
            Conectamos productos frescos con los negocios que alimentan nuestra
            ciudad todos los días.
          </p>
          <a href={`#${anclaHistoria}`} className="hero-cta-suave">
            Conoce nuestra historia
            <ArrowDown size={16} />
          </a>
        </div>

        {/* Campo → Logística → Tu negocio: el papel de la marca en un vistazo. */}
        <img
          className="hero-nosotros-linea"
          src={lineaProcesos}
          alt="Del campo, pasando por nuestra logística, hasta tu negocio"
          decoding="async"
        />
        <ol className="hero-ruta" aria-label="Cómo llega el producto a tu negocio">
          {RUTA.map(({ icono: Icono, texto }, i) => (
            <li key={texto}>
              <span className="hero-ruta-paso">
                <Icono size={15} strokeWidth={1.9} />
                {texto}
              </span>
              {i < RUTA.length - 1 && (
                <ArrowRight size={13} className="hero-ruta-flecha" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="contenedor">
        {(config.historia || config.mision) && (
          <section id="historia-mision" className="seccion" style={{ maxWidth: 720, margin: "0 auto" }}>
            {config.historia && (
              <>
                <h2>Nuestra historia</h2>
                <p style={{ color: "var(--gris)", lineHeight: 1.75 }}>{config.historia}</p>
              </>
            )}
            {config.mision && (
              <>
                <h2>Nuestra misión</h2>
                <p style={{ color: "var(--gris)", lineHeight: 1.75 }}>{config.mision}</p>
              </>
            )}
            <Link to="/tienda" className="btn btn-verde">
              Ir a la tienda
            </Link>
          </section>
        )}

        <section id="valores">
          <div className="seccion-titulo">
            <h2>Lo que nos define</h2>
          </div>
          <div className="valores-grid">
            {VALORES.map((v, i) => {
              const Icono = ICONOS[v.icono];
              return (
                <article className="valor-card glass" key={i}>
                  <span className="icono">
                    <Icono size={24} />
                  </span>
                  <h3>{v.titulo}</h3>
                  <p>{v.texto}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="cta-banda">
          <div>
            <h3>¿Listo para hacer tu primer pedido?</h3>
            <p>Explora nuestro catálogo y arma tu pedido en minutos.</p>
          </div>
          <Link to="/tienda" className="btn btn-ambar">
            Ir a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
