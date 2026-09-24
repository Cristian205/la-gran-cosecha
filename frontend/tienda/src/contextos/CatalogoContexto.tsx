"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useCatalogo } from "@/hooks/useCatalogo";
import {
  OPCIONES_ORDEN,
  obtenerCategorias,
  obtenerUnidadesEnCatalogo,
  type OrdenCatalogo,
} from "@/lib/datos";
import type { Categoria, Paginated, Producto, UnidadMedida } from "@/lib/tipos";

interface CatalogoContextoValor {
  categorias: Categoria[];
  categoriaActiva: number | null;
  cambiarCategoria: (id: number | null) => void;
  /** Las unidades por las que hoy se vende algo (filtro "Se vende por"). */
  unidades: UnidadMedida[];
  unidadActiva: number | null;
  cambiarUnidad: (id: number | null) => void;
  orden: OrdenCatalogo;
  cambiarOrden: (orden: OrdenCatalogo) => void;
  busqueda: string;
  buscar: (valor: string) => void;
  productos: Producto[];
  /** Total del filtro ACTUAL. */
  total: number | null;
  /** Total del catálogo entero, sin filtros: lo que cuenta el encabezado. No
   *  puede ser `total`, que baja a 12 en cuanto alguien elige "Granos". */
  totalCatalogo: number | null;
  cargando: boolean;
  cargandoMas: boolean;
  /** El texto tecleado todavía no llegó al backend (debounce en curso). */
  esperandoBusqueda: boolean;
  error: boolean;
  hayMas: boolean;
  cargarMas: () => void;
  reintentar: () => void;
  hayFiltros: boolean;
  limpiarFiltros: () => void;
}

const Contexto = createContext<CatalogoContextoValor | null>(null);

interface Props {
  children: ReactNode;
  /** La primera tanda, resuelta en el servidor (ver `RESUELVE_EN_SERVIDOR` en
   *  `lib/pagina.ts`). Sin esto el catálogo pintaría vacío hasta que el
   *  navegador termine su primera petición. */
  datosIniciales?: Paginated<Producto>;
  /** Las categorías, resueltas en el mismo momento. Sin esto el total de
   *  productos llegaba del servidor y las categorías las pedía solo el
   *  navegador: la primera pintura decía "190 productos · 0 categorías"
   *  hasta que ese segundo fetch terminara. */
  categoriasIniciales?: Categoria[];
}

const ORDENES_VALIDOS = new Set<string>(OPCIONES_ORDEN.map((o) => o.valor));

function numeroDe(valor: string | null): number | null {
  if (!valor) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * El canal que coordina los bloques de un catálogo interactivo.
 *
 * Un bloque de contenido normal recibe sus `props` y ya: no necesita saber qué
 * pinta el bloque de al lado. Un catálogo interactivo es la excepción —elegir
 * una categoría en `categorias-navegacion` tiene que filtrar lo que pinta
 * `grid-productos`, y los dos son bloques independientes en una composición
 * PLANA (el motor no anida bloques, ver `composicion.py`). Este contexto es
 * ese puente, con el mismo criterio que ya usa `CapaCliente`/`useEnvoltorio`
 * para compartir la búsqueda entre el Navbar y la tienda: nada nuevo, el mismo
 * patrón, un nivel más abajo.
 *
 * Categoría, unidad y orden viven en la URL y no en estado local: un enlace a
 * "/tienda?categoria=5&unidad=3" (desde el Inicio, desde WhatsApp) llega ya
 * filtrado, y "atrás" desde una ficha de producto vuelve al mismo filtro. La
 * búsqueda NO va en la URL: es la del Navbar, compartida en `CapaCliente`, y
 * se escribe letra a letra — reescribir la URL por cada tecla sería ruido.
 *
 * Se envuelve alrededor de la composición de una página `Pagina.Tipo.CATALOGO`
 * (ver `app/tienda/page.tsx`). Un bloque que lo necesite lo pide con
 * `useCatalogoContexto()`, que devuelve `null` si no hay ninguno alrededor —
 * es lo que deja a `grid-productos` funcionar exactamente igual que hoy
 * cuando se coloca suelto en el Inicio, sin este contexto puesto.
 */
export function CatalogoProvider({ children, datosIniciales, categoriasIniciales }: Props) {
  const { busqueda, buscar } = useEnvoltorio();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciales ?? []);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);

  const categoriaActiva = numeroDe(searchParams.get("categoria"));
  const unidadActiva = numeroDe(searchParams.get("unidad"));
  const ordenUrl = searchParams.get("orden");
  const orden: OrdenCatalogo =
    ordenUrl && ORDENES_VALIDOS.has(ordenUrl) ? (ordenUrl as OrdenCatalogo) : "recomendados";

  /** Reescribe uno o varios parámetros de la URL; `null` los quita. */
  function cambiarParametros(cambios: Record<string, string | null>) {
    // `replace` y no `push`: filtrar no debería llenar el historial de
    // entradas que obliguen a pulsar "atrás" varias veces para salir.
    const siguiente = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) siguiente.delete(clave);
      else siguiente.set(clave, valor);
    }
    const cadena = siguiente.toString();
    router.replace(pathname + (cadena ? `?${cadena}` : ""), { scroll: false });
  }

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => undefined);
    obtenerUnidadesEnCatalogo().then(setUnidades).catch(() => undefined);
  }, []);

  const semilla = datosIniciales
    ? {
        productos: datosIniciales.results,
        total: datosIniciales.count,
        hayMas: Boolean(datosIniciales.next),
      }
    : undefined;

  const estado = useCatalogo(
    { busqueda, categoria: categoriaActiva, unidad: unidadActiva, orden },
    semilla
  );

  const sumaCategorias = categorias.reduce((acc, c) => acc + (c.num_productos ?? 0), 0);
  const totalCatalogo = datosIniciales?.count ?? (sumaCategorias > 0 ? sumaCategorias : null);

  const hayFiltros =
    Boolean(busqueda.trim()) || categoriaActiva !== null || unidadActiva !== null;

  return (
    <Contexto.Provider
      value={{
        categorias,
        categoriaActiva,
        cambiarCategoria: (id) => cambiarParametros({ categoria: id === null ? null : String(id) }),
        unidades,
        unidadActiva,
        cambiarUnidad: (id) => cambiarParametros({ unidad: id === null ? null : String(id) }),
        orden,
        cambiarOrden: (valor) =>
          cambiarParametros({ orden: valor === "recomendados" ? null : valor }),
        busqueda,
        buscar,
        productos: estado.productos,
        total: estado.total,
        totalCatalogo,
        cargando: estado.cargando,
        cargandoMas: estado.cargandoMas,
        esperandoBusqueda: estado.esperandoBusqueda,
        error: estado.error,
        hayMas: estado.hayMas,
        cargarMas: estado.cargarMas,
        reintentar: estado.reintentar,
        hayFiltros,
        limpiarFiltros: () => {
          buscar("");
          cambiarParametros({ categoria: null, unidad: null });
        },
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

/** `null` cuando no hay `CatalogoProvider` alrededor — a propósito, ver arriba. */
export function useCatalogoContexto(): CatalogoContextoValor | null {
  return useContext(Contexto);
}
