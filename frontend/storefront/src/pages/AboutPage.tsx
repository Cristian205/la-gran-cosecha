import { Heart, Leaf, Sprout, Truck, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
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

const ICONOS: Record<(typeof VALORES)[number]["icono"], LucideIcon> = {
  leaf: Leaf,
  truck: Truck,
  heart: Heart,
  users: Users,
};

export function AboutPage() {
  const { config } = useSiteConfig();
  useResaltarAlLlegar(config);

  return (
    <div>
      <section className="pagina-hero">
        <span className="etiqueta glass-dark">
          <Sprout size={16} /> Nuestra historia
        </span>
        <h1>Sobre La Gran Cosecha</h1>
        <p>
          Somos el puente entre el campo colombiano y los negocios que alimentan
          la ciudad todos los días.
        </p>
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
