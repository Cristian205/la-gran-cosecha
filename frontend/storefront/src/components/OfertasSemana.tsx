import { Flame, Minus, Plus, ShoppingBasket, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerOfertas } from "../api/content";
import { useAgregarAlCarrito } from "../hooks/useAgregarAlCarrito";
import type { OfertaProducto } from "../types";
import {
  ajustarCantidad,
  colorCategoria,
  formatoCantidad,
  formatoPrecio,
  pasoCantidad,
} from "../utils";

function tiempoRestante(fechaFin: string): string | null {
  const restante = new Date(fechaFin).getTime() - Date.now();
  if (restante <= 0) return null;
  const dias = Math.floor(restante / 86_400_000);
  const horas = Math.floor((restante % 86_400_000) / 3_600_000);
  const minutos = Math.floor((restante % 3_600_000) / 60_000);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

function TarjetaOferta({ oferta }: { oferta: OfertaProducto }) {
  const { agregar, agregado } = useAgregarAlCarrito();
  const paso = pasoCantidad(oferta.producto_permite_fraccion, oferta.producto_tipo_cantidad);
  const [cantidad, setCantidad] = useState(paso);
  const [restante, setRestante] = useState<string | null>(
    oferta.fecha_fin ? tiempoRestante(oferta.fecha_fin) : null
  );

  useEffect(() => {
    if (!oferta.fecha_fin) return;
    const id = setInterval(() => setRestante(tiempoRestante(oferta.fecha_fin!)), 30_000);
    return () => clearInterval(id);
  }, [oferta.fecha_fin]);

  function handleAgregar() {
    agregar({
      productoId: oferta.producto_id,
      productoNombre: oferta.producto_nombre,
      imagenUrl: oferta.producto_imagen_url,
      presentacionId: oferta.presentacion,
      presentacionNombre: `${oferta.presentacion_detalle.nombre_presentacion} · ${oferta.presentacion_detalle.unidad_venta_nombre}`,
      precioUnitario: parseFloat(oferta.precio_oferta),
      cantidad,
      permiteFraccion: oferta.producto_permite_fraccion,
      tipoCantidad: oferta.producto_tipo_cantidad,
    });
    setCantidad(paso);
  }

  return (
    <article className="oferta-card glass" id={`oferta-${oferta.id}`}>
      <div className="oferta-media">
        {oferta.producto_imagen_url ? (
          <img src={oferta.producto_imagen_url} alt={oferta.producto_nombre} loading="lazy" />
        ) : (
          <Flame size={40} strokeWidth={1.5} />
        )}
        <span
          className="oferta-cat-pill"
          style={{ background: colorCategoria(oferta.producto_categoria) }}
        >
          {oferta.producto_categoria_nombre}
        </span>
        <span className="oferta-badge-ahorro">-{oferta.porcentaje_ahorro}%</span>
      </div>
      <div className="oferta-body">
        <h3 className="oferta-nombre">{oferta.producto_nombre}</h3>
        <span className="oferta-presentacion">
          {oferta.presentacion_detalle.nombre_presentacion} ·{" "}
          {oferta.presentacion_detalle.unidad_venta_nombre}
        </span>

        <div className="oferta-precios">
          <span className="oferta-precio-antes">{formatoPrecio(oferta.precio_normal)}</span>
          <span className="oferta-precio-ahora">{formatoPrecio(oferta.precio_oferta)}</span>
        </div>

        {restante ? (
          <span className="oferta-cuenta">
            <Timer size={13} /> Termina en {restante}
          </span>
        ) : (
          <span className="oferta-cuenta sin-fecha">Válida hasta agotar existencias</span>
        )}

        <div className="oferta-linea-cantidad">
          <div className="pc-stepper">
            <button type="button" aria-label="Disminuir" onClick={() => setCantidad((c) => ajustarCantidad(c, -paso, paso))}>
              <Minus size={14} />
            </button>
            {oferta.producto_permite_fraccion ? (
              <span className="pc-cantidad-valor">{formatoCantidad(cantidad, true)}</span>
            ) : (
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={cantidad}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  setCantidad(n > 0 ? n : 1);
                }}
              />
            )}
            <button type="button" aria-label="Aumentar" onClick={() => setCantidad((c) => ajustarCantidad(c, paso, paso))}>
              <Plus size={14} />
            </button>
          </div>

          <button className={`pc-btn-add ${agregado ? "agregado" : ""}`} onClick={handleAgregar}>
            <ShoppingBasket size={16} />
            <span>{agregado ? "¡Agregado!" : "Aprovechar oferta"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function OfertasSemana() {
  const [ofertas, setOfertas] = useState<OfertaProducto[]>([]);

  useEffect(() => {
    obtenerOfertas()
      .then(setOfertas)
      .catch(() => setOfertas([]));
  }, []);

  if (ofertas.length === 0) return null;

  return (
    <section className="seccion ofertas-seccion">
      <div className="seccion-titulo">
        <div>
          <span className="seccion-kicker">Por tiempo limitado</span>
          <h2>Ofertas de la semana</h2>
        </div>
        <span className="linea">Precios que no se repiten</span>
      </div>
      <div className="grid">
        {ofertas.map((o) => (
          <TarjetaOferta key={o.id} oferta={o} />
        ))}
      </div>
    </section>
  );
}
