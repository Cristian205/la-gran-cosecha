"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { useCart } from "@/estado/carrito";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { ImagenProducto } from "@/componentes/tienda/ImagenProducto";
import { cantidadConUnidad, partesPresentacion } from "@/lib/cantidadHumana";
import type { ItemCarrito } from "@/lib/tipos";
import {
  ajustarCantidad,
  formatoCantidad,
  formatoPrecio,
  parsearCantidad,
  pasoCantidad,
} from "@/lib/utiles";

function textoProductos(n: number): string {
  return `${n} producto${n === 1 ? "" : "s"}`;
}

/** Entrada y salida de una línea: colapsa su alto para que las de abajo suban
 *  en vez de saltar. Rápido y sin rebote: es una confirmación, no un adorno. */
const ANIM_LINEA = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, height: "auto" },
  exit: { opacity: 0, x: 24, height: 0, paddingBottom: 0, transition: { duration: 0.22 } },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * El carrito: qué llevo, cuánto cuesta y qué hago ahora.
 *
 * En móvil es una hoja que sube desde abajo y mide lo que mide su contenido:
 * con un producto no queda media pantalla en blanco entre la tarjeta y el
 * total. Con veinte, la lista hace scroll y el resumen se queda abajo, al
 * alcance del pulgar. En escritorio es un panel flotante con el mismo criterio.
 */
export function CartDrawer({ onCerrar }: { onCerrar: () => void }) {
  const { items, personalizados, cambiarCantidad, quitar, quitarPersonalizado, totalLineas, totalPrecio } =
    useCart();
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const hidratado = useCarritoHidratado();

  const lineas = totalLineas();
  const total = totalPrecio();
  const vacio = items.length === 0 && personalizados.length === 0;

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPresionar);
    document.body.classList.add("sin-scroll");
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.classList.remove("sin-scroll");
    };
  }, [onCerrar]);

  function ir(ruta: string) {
    onCerrar();
    router.push(ruta);
  }

  return (
    <>
      <div className="overlay" onClick={onCerrar} />
      <aside
        className="carrito"
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrito-titulo"
        tabIndex={-1}
        ref={panelRef}
      >
        <span className="hoja-asa carrito-asa" aria-hidden="true" />
        <header className="carrito-cab">
          <button className="carrito-cab-btn carrito-volver" onClick={onCerrar} aria-label="Seguir comprando">
            <ArrowLeft size={20} />
          </button>
          <div className="carrito-cab-texto">
            <h2 id="carrito-titulo">Tu carrito</h2>
            {hidratado && !vacio && (
              <p aria-live="polite">{textoProductos(lineas)}</p>
            )}
          </div>
          <button className="carrito-cab-btn carrito-cerrar" onClick={onCerrar} aria-label="Cerrar carrito">
            <X size={20} />
          </button>
        </header>

        {!hidratado ? (
          <CarritoCargando />
        ) : vacio ? (
          <CarritoVacio onExplorar={() => ir("/tienda")} />
        ) : (
          <>
            <div className="carrito-cuerpo">
              <p className="carrito-kicker">Tu pedido</p>
              <ul className="carrito-lista">
                <AnimatePresence initial={false}>
                  {items.map((i) => (
                    <motion.li key={i.presentacionId} className="citem-envoltura" {...ANIM_LINEA}>
                      <LineaCatalogo
                        item={i}
                        onCantidad={cambiarCantidad}
                        onQuitar={() => quitar(i.presentacionId)}
                      />
                    </motion.li>
                  ))}
                  {personalizados.map((p) => (
                    <motion.li key={p.id} className="citem-envoltura" {...ANIM_LINEA}>
                      <article className="citem">
                        <ImagenProducto
                          className="citem-img"
                          tamanoIcono={26}
                          producto={{
                            nombre_producto: p.nombre,
                            imagen_url: null,
                            categoria: p.categoriaId,
                            categoria_nombre: p.categoriaNombre,
                          }}
                        />
                        <div className="citem-cuerpo">
                          <div className="citem-cab">
                            <DescripcionLinea
                              producto={p.nombre}
                              cantidad={cantidadConUnidad(p.cantidad, p.unidadNombre || "unidad")}
                            />
                            <BotonQuitar nombre={p.nombre} onQuitar={() => quitarPersonalizado(p.id)} />
                          </div>
                          <span className="citem-cotizar">Por cotizar · fuera de catálogo</span>
                        </div>
                      </article>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <footer className="carrito-resumen">
              <p className="carrito-kicker">Resumen</p>
              <div className="carrito-fila">
                <span>Subtotal</span>
                <span className="carrito-cifra">{formatoPrecio(total)}</span>
              </div>
              {personalizados.length > 0 && (
                <div className="carrito-fila">
                  <span>Por cotizar</span>
                  <span>{textoProductos(personalizados.length)}</span>
                </div>
              )}
              <div className="carrito-fila carrito-total">
                <span>Total estimado</span>
                <strong key={total} className="carrito-cifra carrito-cifra--cambia" aria-live="polite">
                  {formatoPrecio(total)}
                </strong>
              </div>
              <AvisoPrecios compacto />
              <button className="btn btn-verde btn-block carrito-cta" onClick={() => ir("/tienda/pedido")}>
                Continuar con mi pedido
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

/** `useCart` se rehidrata después del primer render (`skipHydration`): hasta
 *  entonces "vacío" no es verdad, solo "todavía no sé". */
function useCarritoHidratado(): boolean {
  const [hidratado, setHidratado] = useState(() => useCart.persist.hasHydrated());
  useEffect(() => {
    if (hidratado) return;
    const soltar = useCart.persist.onFinishHydration(() => setHidratado(true));
    if (useCart.persist.hasHydrated()) setHidratado(true);
    return soltar;
  }, [hidratado]);
  return hidratado;
}

function LineaCatalogo({
  item,
  onCantidad,
  onQuitar,
}: {
  item: ItemCarrito;
  onCantidad: (presentacionId: number, cantidad: number, paso: number) => void;
  onQuitar: () => void;
}) {
  const paso = pasoCantidad(item.permiteFraccion, item.tipoCantidad);
  const subtotal = item.precioUnitario * item.cantidad;
  const { variante, unidad } = partesPresentacion(item.presentacionNombre);
  const cantidad = cantidadConUnidad(item.cantidad, unidad);
  const esUna = Math.abs(item.cantidad - 1) < 1e-6;

  return (
    <article className="citem">
      <ImagenProducto
        className="citem-img"
        tamanoIcono={26}
        producto={{
          nombre_producto: item.productoNombre,
          imagen_url: item.imagenUrl,
          categoria: item.productoId,
          categoria_nombre: item.productoNombre,
        }}
      />
      <div className="citem-cuerpo">
        <div className="citem-cab">
          <DescripcionLinea producto={item.productoNombre} variante={variante} cantidad={cantidad} />
          <BotonQuitar nombre={item.productoNombre} onQuitar={onQuitar} />
        </div>
        {/* El total de ESTA línea es el precio que importa; el unitario, si
            hace falta, va al pie como dato secundario. */}
        <p key={subtotal} className="citem-total carrito-cifra--cambia" aria-live="polite">
          {formatoPrecio(subtotal)}
        </p>
        <div className="citem-pie">
          <span className="citem-unitario">
            {!esUna && unidad ? `${formatoPrecio(item.precioUnitario)} / ${unidad.toLowerCase()}` : ""}
          </span>
          <CantidadLinea
            nombre={item.productoNombre}
            cantidad={item.cantidad}
            paso={paso}
            permiteFraccion={item.permiteFraccion}
            onCambiar={(n) => onCantidad(item.presentacionId, n, paso)}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Qué se pidió, en una sola lectura: "Mora Castillo · 1 libra".
 *
 * Producto, presentación y cantidad son UNA unidad de información: van en la
 * misma línea (en pantallas estrechas la cantidad baja a la suya, sin
 * achicar la letra). La cantidad está dicha en palabras —"1 caja y 1/2",
 * nunca "1.5"— y resaltada, porque es lo que más se revisa.
 */
function DescripcionLinea({ producto, variante, cantidad }: { producto: string; variante?: string; cantidad: string }) {
  return (
    <h3 className="citem-linea">
      <span className="citem-producto">{producto}</span>
      {variante && (
        <>
          {" "}
          <span className="citem-variante">{variante}</span>
        </>
      )}
      {/* El "·" viaja con la cantidad: si no cabe, bajan juntos y no queda
          un separador colgando al final de la línea. */}{" "}
      <span className="citem-cantidad-grupo">
        <span className="citem-sep" aria-hidden="true">
          ·{" "}
        </span>
        <span className="citem-cantidad">{cantidad}</span>
      </span>
    </h3>
  );
}

function BotonQuitar({ nombre, onQuitar }: { nombre: string; onQuitar: () => void }) {
  return (
    <button type="button" className="citem-quitar" onClick={onQuitar} aria-label={`Quitar ${nombre} del carrito`}>
      <Trash2 size={16} />
    </button>
  );
}

/**
 * La cápsula − cantidad + del carrito. El número se puede escribir, igual que
 * en la tienda (`Cantidad` de QuickAdd): al enfocarlo muestra el decimal y al
 * salir vuelve a la fracción legible.
 */
function CantidadLinea({
  nombre,
  cantidad,
  paso,
  permiteFraccion,
  onCambiar,
}: {
  nombre: string;
  cantidad: number;
  paso: number;
  permiteFraccion: boolean;
  onCambiar: (cantidad: number) => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const enElMinimo = cantidad <= paso;

  function confirmar() {
    if (texto === null) return;
    const valor = parsearCantidad(texto, paso);
    if (valor !== null) onCambiar(valor);
    setTexto(null);
  }

  return (
    <div className="qty qty--carrito" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button
        type="button"
        onClick={() => onCambiar(ajustarCantidad(cantidad, -paso, paso))}
        disabled={enElMinimo}
        aria-label="Disminuir cantidad"
      >
        <Minus size={14} />
      </button>
      <input
        key={cantidad}
        className="qty-valor"
        inputMode="decimal"
        aria-label="Cantidad"
        value={texto ?? formatoCantidad(cantidad, permiteFraccion)}
        onFocus={(e) => {
          setTexto(String(cantidad));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setTexto(null);
            e.currentTarget.blur();
          }
        }}
      />
      <button type="button" onClick={() => onCambiar(ajustarCantidad(cantidad, paso, paso))} aria-label="Aumentar cantidad">
        <Plus size={14} />
      </button>
    </div>
  );
}

function CarritoVacio({ onExplorar }: { onExplorar: () => void }) {
  return (
    <div className="carrito-vacio">
      <span className="carrito-vacio-icono" aria-hidden="true">
        <ShoppingBasket size={30} />
      </span>
      <p className="carrito-vacio-titulo">Tu carrito está vacío</p>
      <p className="carrito-vacio-texto">Agrega frutas, verduras y más productos frescos para armar tu pedido.</p>
      <button className="btn btn-verde carrito-cta" onClick={onExplorar}>
        Explorar la tienda
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function CarritoCargando() {
  return (
    <div className="carrito-cuerpo" aria-busy="true" aria-label="Cargando tu carrito">
      {[0, 1].map((n) => (
        <div key={n} className="citem citem--esqueleto">
          <span className="esq citem-img" />
          <div className="citem-cuerpo">
            <span className="esq" style={{ width: "55%" }} />
            <span className="esq" style={{ width: "35%" }} />
            <span className="esq" style={{ width: "45%", height: "2rem", borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
