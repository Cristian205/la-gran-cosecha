"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useEffect } from "react";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useTienda } from "@/estado/tienda";

const DURACION_MS = 2800;

/**
 * "✓ Agregado a tu pedido": qué entró exactamente y un atajo para verlo.
 *
 * Es la confirmación que no depende de dónde se esté mirando — el botón de
 * la tarjeta cambia, pero en móvil la insignia del carrito puede estar fuera
 * de pantalla. Corto (menos de tres segundos), en `aria-live` para el lector
 * de pantalla, y un aviso nuevo reemplaza al anterior en vez de apilarse:
 * agregar diez productos seguidos no puede llenar la pantalla de avisos.
 */
export function AvisoAgregado() {
  const aviso = useTienda((s) => s.aviso);
  const cerrar = useTienda((s) => s.cerrarAviso);
  const { abrirCarrito } = useEnvoltorio();

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(cerrar, DURACION_MS);
    return () => window.clearTimeout(t);
  }, [aviso, cerrar]);

  return (
    <div className="aviso-agregado-zona" aria-live="polite" role="status">
      {aviso && (
        <div className="aviso-agregado" key={aviso.id}>
          <span className="aviso-agregado-check" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
          <span className="aviso-agregado-texto">
            <strong>{aviso.nombre}</strong>
            <span>{aviso.detalle} · agregado</span>
          </span>
          <button
            type="button"
            className="aviso-agregado-ver"
            onClick={() => {
              cerrar();
              abrirCarrito();
            }}
          >
            Ver pedido <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="aviso-agregado-cerrar" onClick={cerrar} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
          <span className="aviso-agregado-barra" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
