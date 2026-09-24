"use client";

import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { useTienda } from "@/estado/tienda";
import { CompraProducto } from "./CompraProducto";
import { ImagenProducto } from "./ImagenProducto";

/**
 * La vista rápida: el producto en grande sin salir del catálogo.
 *
 * Ir a la ficha completa obligaba a perder el sitio en una rejilla de 190
 * productos —con sus filtros y lo ya cargado— para ver algo que cabe en un
 * panel. Aquí se decide y se agrega, y al cerrar el cliente sigue exactamente
 * donde estaba. La ficha /productos/<slug> sigue existiendo (es la página que
 * se comparte y la que posiciona), y se enlaza desde aquí.
 *
 * Un `<dialog>` nativo con `showModal()`: trae gratis el foco atrapado, Esc
 * para cerrar, el fondo inerte para el lector de pantalla y la capa superior
 * — cosas que a mano siempre acaban con algún hueco.
 */
export function ProductQuickView() {
  const producto = useTienda((s) => s.vistaRapida);
  const cerrar = useTienda((s) => s.cerrarVistaRapida);
  const dialogo = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (producto && !d.open) {
      d.showModal();
      document.body.classList.add("sin-scroll");
    }
    if (!producto && d.open) d.close();
  }, [producto]);

  // Navegar (p. ej. "Ver ficha completa") cierra la vista.
  useEffect(() => {
    cerrar();
  }, [pathname, cerrar]);

  return (
    <dialog
      ref={dialogo}
      className="qv"
      aria-labelledby="qv-titulo"
      onClose={() => {
        document.body.classList.remove("sin-scroll");
        cerrar();
      }}
      // Clic en el fondo (fuera del panel) cierra: el evento llega con el
      // propio <dialog> como destino solo cuando se pulsa su ::backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      {producto && (
        <div className="qv-panel" key={producto.id}>
          <button type="button" className="qv-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X size={20} />
          </button>

          <div className="qv-media">
            <ImagenProducto producto={producto} tamanoIcono={150} prioridad />
          </div>

          <div className="qv-info">
            <span className="qv-cat">{producto.categoria_nombre}</span>
            <h2 id="qv-titulo">{producto.nombre_producto}</h2>

            <CompraProducto producto={producto} />

            <AvisoPrecios compacto />

            <Link href={`/productos/${producto.slug}`} className="qv-ficha">
              Ver ficha completa <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
