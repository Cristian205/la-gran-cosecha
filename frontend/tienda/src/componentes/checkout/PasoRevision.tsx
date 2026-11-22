"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ClipboardList, PackageOpen, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { CantidadLinea } from "@/componentes/CartDrawer";
import { useCart } from "@/estado/carrito";
import { partesPresentacion } from "@/lib/cantidadHumana";
import { obtenerCategorias, obtenerProductosPorIds } from "@/lib/datos";
import type { ItemCarrito, ItemPersonalizado } from "@/lib/tipos";
import { esFraccionaria, formatoCantidad, formatoPrecio, normalizarTexto, reglaDeItem } from "@/lib/utiles";

/** Líneas que se pintan de entrada en cada grupo; el resto, a pedido. */
const LINEAS_POR_TANDA = 20;
/** Hasta cuántas líneas en total los grupos arrancan abiertos. */
const ABIERTOS_HASTA = 20;
/** Cuánto dura el "Deshacer" de una línea quitada. */
const DESHACER_MS = 6000;
const SIN_CATEGORIA = "Otros productos";
/** El filtro `?ids=` del catálogo atiende como mucho 50 ids por consulta
 *  (`filtrar_ids` en `backend/apps/catalog/filters.py`): las tandas, de 50. */
const IDS_POR_CONSULTA = 50;
const FUERA_DE_CATALOGO = "Fuera de catálogo";

interface Grupo {
  clave: string;
  nombre: string;
  items: ItemCarrito[];
  personalizados: ItemPersonalizado[];
  subtotal: number;
}

/**
 * La categoría de cada producto del carrito.
 *
 * El carrito guardado no la trae (y no hace falta cambiar su formato: un
 * carrito de hace un mes o un pedido repetido tampoco la tendrían). Se pide
 * al catálogo por ids, en tandas, una sola vez por producto; el orden de las
 * categorías es el del catálogo. Si falla, todo va a un solo grupo: la
 * revisión sigue funcionando, solo sin agrupar.
 */
function useCategoriasDelPedido(productoIds: number[]) {
  const [porProducto, setPorProducto] = useState<Map<number, string>>(new Map());
  const [ordenCategoria, setOrdenCategoria] = useState<Map<string, number>>(new Map());
  const [listo, setListo] = useState(false);
  const pedidos = useRef(new Set<number>());

  const faltan = productoIds.filter((id) => !pedidos.current.has(id));
  const claveFaltan = faltan.join(",");

  useEffect(() => {
    if (faltan.length === 0) {
      setListo(true);
      return;
    }
    faltan.forEach((id) => pedidos.current.add(id));
    let vivo = true;
    const tandas: number[][] = [];
    for (let i = 0; i < faltan.length; i += IDS_POR_CONSULTA) tandas.push(faltan.slice(i, i + IDS_POR_CONSULTA));
    Promise.all([Promise.all(tandas.map(obtenerProductosPorIds)), obtenerCategorias().catch(() => [])])
      .then(([resultados, categorias]) => {
        if (!vivo) return;
        setPorProducto((previo) => {
          const nuevo = new Map(previo);
          for (const p of resultados.flat()) nuevo.set(p.id, p.categoria_nombre || SIN_CATEGORIA);
          return nuevo;
        });
        if (categorias.length) setOrdenCategoria(new Map(categorias.map((c) => [c.nombre_categoria, c.orden])));
      })
      .catch(() => undefined)
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFaltan]);

  return { porProducto, ordenCategoria, listo };
}

function totalUnidades(items: ItemCarrito[], personalizados: ItemPersonalizado[]): number {
  return items.reduce((s, i) => s + i.cantidad, 0) + personalizados.reduce((s, p) => s + p.cantidad, 0);
}

export function textoUnidades(n: number): string {
  const cifra = n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return `${cifra} ${Math.abs(n - 1) < 1e-6 ? "unidad" : "unidades"}`;
}

export function textoReferencias(n: number): string {
  return `${n} ${n === 1 ? "referencia" : "referencias"}`;
}

/**
 * Paso 3: revisar y corregir el pedido sin volver al catálogo.
 *
 * Pensado para pedidos de abastecimiento de 100 líneas o más:
 *   - Agrupado por categoría en grupos desplegables (cerrados de entrada si
 *     el pedido es largo), con su número de líneas y su subtotal.
 *   - Un buscador que filtra todas las líneas y abre los grupos que tienen
 *     coincidencias.
 *   - Dentro de cada grupo, las líneas de 20 en 20 ("Ver 15 más"): nada de
 *     una lista infinita.
 *   - Cantidad editable con las mismas reglas del catálogo (mínimo, de cuánto
 *     en cuánto, fracciones) y quitar con "Deshacer".
 *   - El total siempre a la vista: lo lleva el pie fijo del checkout.
 */
export function PasoRevision() {
  const { items, personalizados, cambiarCantidad, quitar, agregar, quitarPersonalizado } = useCart();
  const productoIds = useMemo(() => [...new Set(items.map((i) => i.productoId))], [items]);
  const { porProducto, ordenCategoria, listo } = useCategoriasDelPedido(productoIds);
  const [busqueda, setBusqueda] = useState("");
  const [abiertos, setAbiertos] = useState<Set<string> | null>(null);
  const [quitado, setQuitado] = useState<ItemCarrito | null>(null);

  const q = normalizarTexto(busqueda.trim());
  const coincide = (texto: string) => !q || normalizarTexto(texto).includes(q);

  const grupos = useMemo<Grupo[]>(() => {
    const mapa = new Map<string, Grupo>();
    const grupo = (nombre: string) => {
      let g = mapa.get(nombre);
      if (!g) {
        g = { clave: nombre, nombre, items: [], personalizados: [], subtotal: 0 };
        mapa.set(nombre, g);
      }
      return g;
    };
    for (const item of items) {
      const nombre = listo ? porProducto.get(item.productoId) ?? SIN_CATEGORIA : "Tu pedido";
      const g = grupo(nombre);
      g.items.push(item);
      g.subtotal += item.precioUnitario * item.cantidad;
    }
    for (const p of personalizados) grupo(FUERA_DE_CATALOGO).personalizados.push(p);
    const peso = (g: Grupo) =>
      g.nombre === FUERA_DE_CATALOGO ? 1e9 : g.nombre === SIN_CATEGORIA ? 1e8 : ordenCategoria.get(g.nombre) ?? 1e7;
    return [...mapa.values()].sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"));
  }, [items, personalizados, porProducto, ordenCategoria, listo]);

  // Abiertos de entrada si el pedido es corto; cerrados si es largo. Se decide
  // una vez, cuando ya hay grupos de verdad, y después manda el cliente.
  useEffect(() => {
    if (!listo || abiertos !== null) return;
    const lineas = items.length + personalizados.length;
    setAbiertos(new Set(lineas <= ABIERTOS_HASTA ? grupos.map((g) => g.clave) : []));
  }, [listo, abiertos, grupos, items.length, personalizados.length]);

  useEffect(() => {
    if (!quitado) return;
    const t = window.setTimeout(() => setQuitado(null), DESHACER_MS);
    return () => window.clearTimeout(t);
  }, [quitado]);

  const referencias = items.length + personalizados.length;
  if (referencias === 0) {
    return (
      <section className="chk-seccion chk-vacio" aria-labelledby="chk-pedido-titulo">
        <h2 className="chk-titulo" id="chk-pedido-titulo" tabIndex={-1}>
          <PackageOpen size={20} aria-hidden="true" /> Tu pedido está vacío
        </h2>
        {quitado ? (
          <BarraDeshacer
            item={quitado}
            onDeshacer={() => {
              agregar(quitado);
              setQuitado(null);
            }}
          />
        ) : (
          <p className="chk-texto">Agrega productos desde la tienda para continuar.</p>
        )}
        <Link href="/tienda" className="btn btn-verde">
          Ir a la tienda
        </Link>
      </section>
    );
  }

  const visibles = grupos
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => coincide(`${i.productoNombre} ${i.presentacionNombre}`)),
      personalizados: g.personalizados.filter((p) => coincide(`${p.nombre} ${p.unidadNombre}`)),
    }))
    .filter((g) => g.items.length + g.personalizados.length > 0);
  const resultados = visibles.reduce((s, g) => s + g.items.length + g.personalizados.length, 0);
  const todosAbiertos = abiertos !== null && grupos.every((g) => abiertos.has(g.clave));

  function alternar(clave: string) {
    setAbiertos((previo) => {
      const nuevo = new Set(previo ?? []);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  return (
    <section className="chk-seccion" aria-labelledby="chk-pedido-titulo">
      <div className="chk-pedido-cab">
        <h2 className="chk-titulo" id="chk-pedido-titulo" tabIndex={-1}>
          <ClipboardList size={20} aria-hidden="true" /> Revisa tu pedido
        </h2>
        <Link href="/tienda" className="checkout-editar chk-agregar">
          <Plus size={14} aria-hidden="true" /> Agregar productos
        </Link>
      </div>
      <p className="chk-contadores" aria-live="polite">
        <span>{textoReferencias(referencias)}</span>
        <span aria-hidden="true">·</span>
        <span>{textoUnidades(totalUnidades(items, personalizados))}</span>
      </p>

      <div className="chk-herramientas">
        <label className="chk-buscar">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Buscar en tu pedido</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en tu pedido…"
            autoComplete="off"
          />
          {busqueda && (
            <button type="button" className="chk-buscar-limpiar" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
              <X size={15} />
            </button>
          )}
        </label>
        {grupos.length > 1 && !q && (
          <button
            type="button"
            className="chk-plegar"
            onClick={() => setAbiertos(new Set(todosAbiertos ? [] : grupos.map((g) => g.clave)))}
          >
            {todosAbiertos ? "Cerrar todo" : "Abrir todo"}
          </button>
        )}
      </div>

      {quitado && (
        <BarraDeshacer
          item={quitado}
          onDeshacer={() => {
            agregar(quitado);
            setQuitado(null);
          }}
        />
      )}

      {q && (
        <p className="chk-estado" role="status">
          {resultados === 0
            ? `Ningún producto de tu pedido coincide con «${busqueda.trim()}».`
            : `${resultados} ${resultados === 1 ? "producto coincide" : "productos coinciden"}.`}
        </p>
      )}

      {!listo ? (
        <p className="chk-estado" role="status">
          Organizando tu pedido por categoría…
        </p>
      ) : (
        <div className="chk-grupos">
          {visibles.map((g) => (
            <GrupoPedido
              key={g.clave}
              grupo={g}
              total={grupos.find((x) => x.clave === g.clave)!}
              abierto={Boolean(q) || Boolean(abiertos?.has(g.clave))}
              forzado={Boolean(q)}
              onAlternar={() => alternar(g.clave)}
              onCantidad={cambiarCantidad}
              onQuitar={(item) => {
                quitar(item.presentacionId);
                setQuitado(item);
              }}
              onQuitarPersonalizado={quitarPersonalizado}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BarraDeshacer({ item, onDeshacer }: { item: ItemCarrito; onDeshacer: () => void }) {
  return (
    <div className="chk-deshacer" role="status">
      <span>
        Quitaste <b>{item.productoNombre}</b>.
      </span>
      <button type="button" onClick={onDeshacer}>
        <Undo2 size={15} aria-hidden="true" /> Deshacer
      </button>
    </div>
  );
}

function GrupoPedido({
  grupo,
  total,
  abierto,
  forzado,
  onAlternar,
  onCantidad,
  onQuitar,
  onQuitarPersonalizado,
}: {
  /** Las líneas que se ven (filtradas por la búsqueda). */
  grupo: Grupo;
  /** El grupo completo: su número de líneas y subtotal no cambian al buscar. */
  total: Grupo;
  abierto: boolean;
  /** Abierto por una búsqueda: el encabezado no lo cierra. */
  forzado: boolean;
  onAlternar: () => void;
  onCantidad: (presentacionId: number, cantidad: number, minimo: number) => void;
  onQuitar: (item: ItemCarrito) => void;
  onQuitarPersonalizado: (id: string) => void;
}) {
  const [mostrar, setMostrar] = useState(LINEAS_POR_TANDA);
  const lineas = total.items.length + total.personalizados.length;
  const idCuerpo = `chk-grupo-${normalizarTexto(grupo.clave).replace(/\W+/g, "-")}`;
  const itemsVisibles = forzado ? grupo.items : grupo.items.slice(0, mostrar);
  const restantes = grupo.items.length - itemsVisibles.length;

  return (
    <div className="chk-grupo" data-abierto={abierto}>
      <button
        type="button"
        className="chk-grupo-cab"
        onClick={onAlternar}
        aria-expanded={abierto}
        aria-controls={idCuerpo}
        disabled={forzado}
      >
        <span className="chk-grupo-nombre">{grupo.nombre}</span>
        <span className="chk-grupo-cuenta">{lineas}</span>
        <span className="chk-grupo-subtotal">
          {total.subtotal > 0 ? formatoPrecio(total.subtotal) : "Por confirmar"}
        </span>
        <ChevronDown size={18} className="chk-grupo-chevron" aria-hidden="true" />
      </button>
      {abierto && (
        <div className="chk-grupo-cuerpo" id={idCuerpo}>
          <ul className="chk-lineas">
            {itemsVisibles.map((item) => (
              <LineaRevision
                key={item.presentacionId}
                item={item}
                onCantidad={onCantidad}
                onQuitar={() => onQuitar(item)}
              />
            ))}
            {grupo.personalizados.map((p) => (
              <li className="chk-linea chk-linea--personalizada" key={p.id}>
                <div className="chk-linea-info">
                  <span className="chk-linea-nombre">{p.nombre}</span>
                  <span className="chk-linea-detalle">
                    {formatoCantidad(p.cantidad, true)} {p.unidadNombre || "unid."} · fuera de catálogo
                  </span>
                </div>
                <span className="chk-linea-subtotal chk-linea-subtotal--pendiente">Por confirmar</span>
                <button
                  type="button"
                  className="citem-quitar chk-linea-quitar"
                  onClick={() => onQuitarPersonalizado(p.id)}
                  aria-label={`Quitar ${p.nombre} del pedido`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          {restantes > 0 && (
            <button type="button" className="chk-ver-mas" onClick={() => setMostrar((n) => n + LINEAS_POR_TANDA)}>
              Ver {Math.min(restantes, LINEAS_POR_TANDA)} más de {grupo.nombre.toLowerCase()} ({restantes} sin mostrar)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Una línea: nombre, variedad · unidad, precio por unidad, la cantidad
 * editable (mismas reglas que el catálogo), el subtotal y quitar.
 */
function LineaRevision({
  item,
  onCantidad,
  onQuitar,
}: {
  item: ItemCarrito;
  onCantidad: (presentacionId: number, cantidad: number, minimo: number) => void;
  onQuitar: () => void;
}) {
  const regla = reglaDeItem(item);
  const { variante, unidad } = partesPresentacion(item.presentacionNombre);
  const subtotal = item.precioUnitario * item.cantidad;
  return (
    <li className="chk-linea">
      <div className="chk-linea-info">
        <span className="chk-linea-nombre">{item.productoNombre}</span>
        <span className="chk-linea-detalle">
          {[variante, unidad].filter(Boolean).join(" · ")}
          <span className="chk-linea-unitario">
            {" "}
            · {formatoPrecio(item.precioUnitario)}
            {unidad ? ` / ${unidad.toLowerCase()}` : ""}
          </span>
        </span>
      </div>
      <CantidadLinea
        nombre={item.productoNombre}
        cantidad={item.cantidad}
        paso={regla.paso}
        minimo={regla.minimo}
        permiteFraccion={item.permiteFraccion || esFraccionaria(regla)}
        onCambiar={(n) => onCantidad(item.presentacionId, n, regla.minimo)}
      />
      <span key={subtotal} className="chk-linea-subtotal carrito-cifra--cambia">
        {formatoPrecio(subtotal)}
      </span>
      <button
        type="button"
        className="citem-quitar chk-linea-quitar"
        onClick={onQuitar}
        aria-label={`Quitar ${item.productoNombre} del pedido`}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
