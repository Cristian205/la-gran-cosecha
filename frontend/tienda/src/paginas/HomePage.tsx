"use client";

import type { Producto } from "@/lib/tipos";
import Link from "next/link";
import { ClipboardList, Search, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { CategoriasDestacadas } from "@/componentes/CategoriasDestacadas";
import { CotizacionRapida } from "@/componentes/CotizacionRapida";
import { EstadisticasConfianza } from "@/componentes/EstadisticasConfianza";
import { MasVendidos } from "@/componentes/MasVendidos";
import { OfertasSemana } from "@/componentes/OfertasSemana";
import { PorQueElegirnos } from "@/componentes/PorQueElegirnos";
import { PromoCarousel } from "@/componentes/PromoCarousel";
import { RepetirPedido } from "@/componentes/RepetirPedido";
import { Testimonials } from "@/componentes/Testimonials";
import { TrustBadges } from "@/componentes/TrustBadges";
import { useSiteConfig } from "@/componentes/CapaCliente";

const ICONOS_PASO: LucideIcon[] = [Search, ClipboardList, Truck];

interface Props {
  /** Los más vendidos, resueltos en el servidor: son el contenido que el
   *  rastreador tiene que ver en el HTML del inicio. */
  destacados: Producto[];
}

export function HomePage({ destacados }: Props) {
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

        <MasVendidos iniciales={destacados} />

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
          <Link href="/tienda" className="btn btn-ambar">
            <ShoppingBag size={18} />
            Ir a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
