"use client";

import { ArrowRight, PackageSearch, RotateCw, SearchX } from "lucide-react";
import { CustomProductForm } from "@/componentes/CustomProductForm";
import { useEnvoltorio, useSiteConfig } from "@/componentes/CapaCliente";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { useCatalogoContexto } from "@/contextos/CatalogoContexto";
import { useCart } from "@/estado/carrito";
import { formatoPrecio } from "@/lib/utiles";

/**
 * Los estados del catálogo que no son "la rejilla llena": cargando, vacío,
 * sin resultados y error. Cada uno dice qué pasó y ofrece la salida más
 * corta — nunca un hueco en blanco ni un texto suelto improvisado.
 */

/** La silueta de una tarjeta mientras llega la de verdad. */
export function LoadingProductCard() {
  return (
    <div className="pcard pcard--esqueleto" aria-hidden="true">
      <div className="pcard-media">
        <div className="pimg is-cargando" />
      </div>
      <div className="pcard-cuerpo">
        <span className="esq esq--corto" />
        <span className="esq esq--largo" />
        <span className="esq esq--medio" />
        <div className="pcard-compra">
          <span className="esq esq--precio" />
          <span className="esq esq--boton" />
        </div>
      </div>
    </div>
  );
}

export function EsqueletosCatalogo({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <LoadingProductCard key={i} />
      ))}
    </>
  );
}

/** Búsqueda o filtro sin resultados. */
export function EmptySearch() {
  const catalogo = useCatalogoContexto();
  if (!catalogo) return null;

  const q = catalogo.busqueda.trim();
  const categoria = catalogo.categorias.find((c) => c.id === catalogo.categoriaActiva) ?? null;
  const unidad = catalogo.unidades.find((u) => u.id === catalogo.unidadActiva) ?? null;

  let titulo = "No hay productos con estos filtros";
  let texto = "Quita alguno de los filtros para ver más productos.";
  if (q) {
    titulo = `No encontramos “${q}”`;
    texto = categoria
      ? `Buscamos solo en ${categoria.nombre_categoria}. Prueba en todo el catálogo o con otra palabra.`
      : "Revisa cómo está escrito o prueba con una palabra más corta.";
  } else if (categoria && unidad) {
    titulo = `No hay ${categoria.nombre_categoria.toLowerCase()} por ${unidad.nombre_unidad.toLowerCase()}`;
    texto = "Prueba con otra unidad de venta o con otra categoría.";
  }

  return (
    <div className="estado-cat" role="status">
      <SearchX size={40} strokeWidth={1.5} aria-hidden="true" />
      <h3>{titulo}</h3>
      <p>{texto}</p>
      <div className="estado-cat-acciones">
        {q && categoria && (
          <button type="button" className="btn btn-verde btn-sm" onClick={() => catalogo.cambiarCategoria(null)}>
            Buscar en todo el catálogo
          </button>
        )}
        {catalogo.hayFiltros && (
          <button type="button" className="btn btn-outline btn-sm" onClick={catalogo.limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>
      {q && (
        // Un negocio que no encuentra un producto no debería irse sin pedirlo:
        // queda en el pedido como producto especial y se confirma al recibirlo.
        <div className="estado-cat-especial">
          <CustomProductForm
            categorias={catalogo.categorias}
            categoriaFija={categoria}
            nombreInicial={q}
            textoBoton={`Pedir “${q}” como producto especial`}
          />
        </div>
      )}
    </div>
  );
}

/** No se pudo cargar la primera tanda. */
export function ErrorCatalogo() {
  const catalogo = useCatalogoContexto();
  return (
    <div className="estado-cat" role="alert">
      <PackageSearch size={40} strokeWidth={1.5} aria-hidden="true" />
      <h3>No pudimos cargar el catálogo</h3>
      <p>Revisa tu conexión e inténtalo de nuevo. Tu pedido sigue guardado.</p>
      <div className="estado-cat-acciones">
        <button type="button" className="btn btn-verde btn-sm" onClick={catalogo?.reintentar}>
          <RotateCw size={15} aria-hidden="true" /> Reintentar
        </button>
      </div>
    </div>
  );
}

/**
 * El cierre del catálogo: la tienda termina en "tu pedido", no en otra
 * landing. Si hay algo en el carrito, el siguiente paso es revisarlo; si no,
 * la salida útil es pedir lo que no se encontró. Debajo, la única nota de
 * confianza que importa en esta pantalla: cómo funciona el precio.
 */
export function CierreCatalogo() {
  const catalogo = useCatalogoContexto();
  const { abrirCarrito } = useEnvoltorio();
  const { config } = useSiteConfig();
  const lineas = useCart((s) => s.totalLineas());
  const total = useCart((s) => s.totalPrecio());
  const recibePedidos = config.acepta_pedidos_online !== false;

  if (!catalogo || !recibePedidos) return null;

  return (
    <aside className="cierre-cat" aria-label="Tu pedido">
      {lineas > 0 ? (
        <div className="cierre-cat-pedido">
          <div>
            <p className="cierre-cat-kicker">Tu pedido</p>
            <p className="cierre-cat-titulo">
              {lineas} {lineas === 1 ? "producto" : "productos"} · <b>{formatoPrecio(total)}</b> aprox.
            </p>
          </div>
          <button type="button" className="btn btn-verde" onClick={abrirCarrito}>
            Revisar y finalizar pedido <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="cierre-cat-pedido">
          <div>
            <p className="cierre-cat-kicker">¿Te falta algo?</p>
            <p className="cierre-cat-titulo">Si no está en el catálogo, pídelo igual.</p>
          </div>
          <CustomProductForm
            categorias={catalogo.categorias}
            textoBoton="Agregar un producto especial"
          />
        </div>
      )}
      <AvisoPrecios compacto />
    </aside>
  );
}
