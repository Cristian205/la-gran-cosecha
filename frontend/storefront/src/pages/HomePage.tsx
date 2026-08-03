import { ClipboardList, Search, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoriasDestacadas } from "../components/CategoriasDestacadas";
import { PromoCarousel } from "../components/PromoCarousel";
import { RepetirPedido } from "../components/RepetirPedido";
import { Testimonials } from "../components/Testimonials";
import { TrustBadges } from "../components/TrustBadges";

const PASOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: Search,
    titulo: "1. Explora el catálogo",
    texto: "Filtra por categoría o busca directo lo que necesitas para tu negocio.",
  },
  {
    icono: ClipboardList,
    titulo: "2. Arma tu pedido",
    texto: "Elige presentación, unidad y cantidad — hasta fraccionada si el producto lo permite.",
  },
  {
    icono: Truck,
    titulo: "3. Coordinamos la entrega",
    texto: "Confirmamos contigo por WhatsApp y despachamos directo a tu negocio.",
  },
];

export function HomePage() {
  return (
    <div>
      <PromoCarousel />

      <div className="contenedor">
        <TrustBadges />

        <RepetirPedido />

        <CategoriasDestacadas />

        <section className="seccion">
          <div className="seccion-titulo">
            <h2>Pedir es simple</h2>
            <span className="linea">De la búsqueda a tu bodega en tres pasos</span>
          </div>
          <div className="valores-grid">
            {PASOS.map((paso) => (
              <article className="valor-card glass" key={paso.titulo}>
                <span className="icono">
                  <paso.icono size={24} />
                </span>
                <h3>{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="cta-banda">
          <div>
            <h3>Tu pedido, listo en minutos</h3>
            <p>
              Explora nuestro catálogo completo, arma tu pedido y coordina la
              entrega directamente con nosotros.
            </p>
          </div>
          <Link to="/tienda" className="btn btn-ambar">
            <ShoppingBag size={18} />
            Ir a la tienda
          </Link>
        </div>

        <Testimonials />
      </div>
    </div>
  );
}
