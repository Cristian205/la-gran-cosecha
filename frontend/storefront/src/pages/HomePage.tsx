import { ClipboardList, Search, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoriasDestacadas } from "../components/CategoriasDestacadas";
import { CotizacionRapida } from "../components/CotizacionRapida";
import { EstadisticasConfianza } from "../components/EstadisticasConfianza";
import { MasVendidos } from "../components/MasVendidos";
import { OfertasSemana } from "../components/OfertasSemana";
import { PorQueElegirnos } from "../components/PorQueElegirnos";
import { PromoCarousel } from "../components/PromoCarousel";
import { RepetirPedido } from "../components/RepetirPedido";
import { Testimonials } from "../components/Testimonials";
import { TrustBadges } from "../components/TrustBadges";
import { useSiteConfig } from "../context/SiteConfigContext";

const ICONOS_PASO: LucideIcon[] = [Search, ClipboardList, Truck];

export function HomePage() {
  const { config } = useSiteConfig();

  const pasos = [
    { titulo: config.paso1_titulo, texto: config.paso1_texto },
    { titulo: config.paso2_titulo, texto: config.paso2_texto },
    { titulo: config.paso3_titulo, texto: config.paso3_texto },
  ];

  return (
    <div>
      <PromoCarousel />

      <div className="contenedor">
        <TrustBadges />

        <RepetirPedido />

        <MasVendidos />

        <OfertasSemana />

        <CategoriasDestacadas />

        <PorQueElegirnos />

        <EstadisticasConfianza />

        <Testimonials />

        <section className="seccion">
          <div className="seccion-titulo">
            <div>
              <span className="seccion-kicker">Cómo funciona</span>
              <h2>Pedir es simple</h2>
            </div>
            <span className="linea">De la búsqueda a tu bodega en tres pasos</span>
          </div>
          <div className="valores-grid">
            {pasos.map((paso, i) => {
              const Icono = ICONOS_PASO[i];
              return (
                <article className="valor-card glass" key={paso.titulo}>
                  <span className="icono">
                    <Icono size={24} />
                  </span>
                  <h3>
                    {i + 1}. {paso.titulo}
                  </h3>
                  <p>{paso.texto}</p>
                </article>
              );
            })}
          </div>
        </section>

        <CotizacionRapida />

        <div className="cta-banda">
          <div>
            <h3>{config.cta_final_titulo}</h3>
            <p>{config.cta_final_texto}</p>
          </div>
          <Link to="/tienda" className="btn btn-ambar">
            <ShoppingBag size={18} />
            Ir a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
