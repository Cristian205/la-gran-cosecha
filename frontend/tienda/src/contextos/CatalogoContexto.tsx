"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useCatalogo } from "@/hooks/useCatalogo";
import { obtenerCategorias, type OrdenCatalogo } from "@/lib/datos";
import type { Categoria, Paginated, Producto } from "@/lib/tipos";

interface CatalogoContextoValor {
  categorias: Categoria[];
  categoriaActiva: number | null;
  cambiarCategoria: (id: number | null) => void;
  orden: OrdenCatalogo;
  cambiarOrden: (orden: OrdenCatalogo) => void;
  busqueda: string;
  productos: Producto[];
  total: number | null;
  cargando: boolean;
  cargandoMas: boolean;
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
  const [orden, setOrden] = useState<OrdenCatalogo>("recomendados");

  // La categoría vive en la URL y no en estado local: así un enlace a
  // "/tienda?categoria=5" (desde una categoría del Inicio) llega ya filtrado.
  const categoriaActiva = searchParams.get("categoria")
    ? Number(searchParams.get("categoria"))
    : null;

  function cambiarCategoria(id: number | null) {
    // `replace` y no `push`: filtrar no debería llenar el historial de
    // entradas que obliguen a pulsar "atrás" varias veces para salir.
    const siguiente = new URLSearchParams(searchParams.toString());
    if (id === null) siguiente.delete("categoria");
    else siguiente.set("categoria", String(id));
    const cadena = siguiente.toString();
    router.replace(pathname + (cadena ? `?${cadena}` : ""), { scroll: false });
  }

  useEffect(() => {
    obtenerCategorias().then(setCategorias).catch(() => undefined);
  }, []);

  const semilla = datosIniciales
    ? {
        productos: datosIniciales.results,
        total: datosIniciales.count,
        hayMas: Boolean(datosIniciales.next),
      }
    : undefined;

  const {
    productos,
    total,
    cargando,
    cargandoMas,
    error,
    hayMas,
    cargarMas,
    reintentar,
  } = useCatalogo({ busqueda, categoria: categoriaActiva, orden }, semilla);

  const hayFiltros = Boolean(busqueda.trim()) || categoriaActiva !== null;

  function limpiarFiltros() {
    buscar("");
    cambiarCategoria(null);
  }

  return (
    <Contexto.Provider
      value={{
        categorias,
        categoriaActiva,
        cambiarCategoria,
        orden,
        cambiarOrden: setOrden,
        busqueda,
        productos,
        total,
        cargando,
        cargandoMas,
        error,
        hayMas,
        cargarMas,
        reintentar,
        hayFiltros,
        limpiarFiltros,
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
