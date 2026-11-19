import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  editarPedido,
  obtenerCategorias,
  obtenerLineaDeTiempoPedido,
  obtenerPedido,
  obtenerProductos,
  obtenerUnidades,
} from "../../../api/resources";
import type { Categoria, EventoPedido, PedidoDetalle, Producto, UnidadMedida } from "../../../types";
import { extraerMensajeError } from "../../../utils";
import {
  calcularCambios,
  construirPayload,
  entregaDesdePedido,
  lineaDesdeDetalle,
  totalDe,
  validarEntrega,
  validarLinea,
  type EntregaEditable,
  type ErroresLinea,
  type LineaEditable,
} from "./modelo";

export type EstadoAccion = "inactivo" | "cargando" | "exito" | "error";

/** Lo que llega del panel «Agregar producto»: una línea aún sin guardar. */
export type NuevaLinea = Omit<
  LineaEditable,
  "clave" | "id" | "eliminada" | "origen" | "cantidad_original" | "precio_original" | "agregado_por_nombre" | "fue_modificado" | "estado_revision"
>;

/**
 * Todo el estado del modal de un pedido. Vive aquí —y no en cada pestaña—
 * para que cambiar de pestaña no pierda nada: las pestañas solo leen y piden.
 */
export function useGestionPedido(pedidoId: number, soloLectura: boolean, onGuardado: () => void) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [entrega, setEntrega] = useState<EntregaEditable | null>(null);
  const [eventos, setEventos] = useState<EventoPedido[] | null>(null);
  const [errorEventos, setErrorEventos] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [catalogoCargado, setCatalogoCargado] = useState(false);

  const [estadoGuardado, setEstadoGuardado] = useState<EstadoAccion>("inactivo");
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);

  const guardandoRef = useRef(false);
  const contadorNuevas = useRef(0);
  const temporizador = useRef<number>();

  // ---------- Carga ----------

  const aplicarPedido = useCallback((p: PedidoDetalle) => {
    setPedido(p);
    setLineas(p.detalles.map(lineaDesdeDetalle));
    setEntrega(entregaDesdePedido(p));
  }, []);

  const cargarEventos = useCallback(() => {
    setErrorEventos(false);
    return obtenerLineaDeTiempoPedido(pedidoId)
      .then(setEventos)
      .catch(() => setErrorEventos(true));
  }, [pedidoId]);

  const recargar = useCallback(() => {
    setErrorCarga(null);
    setConflicto(false);
    setErrorGuardado(null);
    setEstadoGuardado("inactivo");
    return obtenerPedido(pedidoId)
      .then(aplicarPedido)
      .catch((e) => setErrorCarga(extraerMensajeError(e, "No se pudo cargar el pedido.")));
  }, [pedidoId, aplicarPedido]);

  useEffect(() => {
    void recargar();
    void cargarEventos();
  }, [recargar, cargarEventos]);

  useEffect(() => {
    if (soloLectura) return;
    let vivo = true;
    Promise.all([obtenerProductos({ estado: "activos" }), obtenerCategorias(), obtenerUnidades()])
      .then(([p, c, u]) => {
        if (!vivo) return;
        setProductos(p);
        setCategorias(c.filter((x) => x.estado_categoria !== false));
        setUnidades(u.filter((x) => x.estado_unidad !== false));
      })
      .catch(() => undefined)
      .finally(() => vivo && setCatalogoCargado(true));
    return () => {
      vivo = false;
    };
  }, [soloLectura]);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  // ---------- Derivados ----------

  const base = useMemo(() => {
    const mapa = new Map<number, LineaEditable>();
    pedido?.detalles.forEach((d) => mapa.set(d.id, lineaDesdeDetalle(d)));
    return mapa;
  }, [pedido]);

  const entregaBase = useMemo(() => (pedido ? entregaDesdePedido(pedido) : null), [pedido]);

  const cambios = useMemo(
    () =>
      entrega && entregaBase
        ? calcularCambios(lineas, base, entrega, entregaBase)
        : { editadas: 0, agregadas: 0, eliminadas: 0, entrega: 0, total: 0 },
    [lineas, base, entrega, entregaBase]
  );

  const errores = useMemo(() => {
    const mapa = new Map<string, ErroresLinea>();
    for (const l of lineas) {
      if (l.eliminada) continue;
      const e = validarLinea(l);
      if (Object.keys(e).length) mapa.set(l.clave, e);
    }
    return mapa;
  }, [lineas]);

  const erroresEntrega = useMemo(() => (entrega ? validarEntrega(entrega) : {}), [entrega]);
  const total = useMemo(() => totalDe(lineas), [lineas]);
  const activas = useMemo(() => lineas.filter((l) => !l.eliminada), [lineas]);

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  // ---------- Edición ----------

  const conflictoRef = useRef(false);
  conflictoRef.current = conflicto;

  const tocar = useCallback(() => {
    // Cualquier edición después de un error o un éxito vuelve el botón a su
    // estado normal, y el aviso de validación desaparece: la persona ya está
    // corrigiendo. El de conflicto se queda: editar no lo resuelve.
    setEstadoGuardado((e) => (e === "cargando" ? e : "inactivo"));
    if (!conflictoRef.current) setErrorGuardado(null);
  }, []);

  const cambiarLinea = useCallback(
    (clave: string, cambio: Partial<LineaEditable>) => {
      setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
      tocar();
    },
    [tocar]
  );

  const cambiarPresentacion = useCallback(
    (clave: string, presentacionId: number) => {
      setLineas((prev) =>
        prev.map((l) => {
          if (l.clave !== clave) return l;
          const producto = l.producto_id != null ? productoPorId.get(l.producto_id) : undefined;
          const pres = producto?.presentaciones.find((p) => p.id === presentacionId);
          if (!pres) return l;
          return {
            ...l,
            presentacion_id: pres.id,
            presentacion_nombre: pres.nombre_presentacion,
            unidad_id: pres.unidad_venta,
            unidad_nombre: pres.unidad_venta_nombre,
            // Otra presentación es otro precio de lista.
            precio_unitario: String(Number(pres.precio_unitario)),
          };
        })
      );
      tocar();
    },
    [productoPorId, tocar]
  );

  /** Las guardadas se marcan (y se pueden restaurar); las nuevas se quitan sin más. */
  const quitarLinea = useCallback(
    (clave: string) => {
      setLineas((prev) =>
        prev.flatMap((l) => {
          if (l.clave !== clave) return [l];
          return l.id === null ? [] : [{ ...l, eliminada: true }];
        })
      );
      tocar();
    },
    [tocar]
  );

  const restaurarLinea = useCallback(
    (clave: string) => {
      setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, eliminada: false } : l)));
      tocar();
    },
    [tocar]
  );

  /** Deshace los cambios de una línea guardada: vuelve a lo último guardado. */
  const revertirLinea = useCallback(
    (clave: string) => {
      setLineas((prev) =>
        prev.map((l) => (l.id !== null && l.clave === clave ? base.get(l.id) ?? l : l))
      );
      tocar();
    },
    [base, tocar]
  );

  const agregarLinea = useCallback(
    (nueva: NuevaLinea): string => {
      contadorNuevas.current += 1;
      const clave = `n${contadorNuevas.current}`;
      setLineas((prev) => [
        ...prev,
        {
          ...nueva,
          clave,
          id: null,
          eliminada: false,
          origen: "ADMIN",
          estado_revision: null,
          cantidad_original: null,
          precio_original: null,
          agregado_por_nombre: "",
          fue_modificado: false,
        },
      ]);
      tocar();
      return clave;
    },
    [tocar]
  );

  const cambiarEntrega = useCallback(
    (campo: keyof EntregaEditable, valor: string) => {
      setEntrega((prev) => (prev ? { ...prev, [campo]: valor } : prev));
      tocar();
    },
    [tocar]
  );

  const descartarCambios = useCallback(() => {
    if (pedido) aplicarPedido(pedido);
    setErrorGuardado(null);
    setEstadoGuardado("inactivo");
  }, [pedido, aplicarPedido]);

  // ---------- Guardar ----------

  /** Devuelve qué falló (para llevar a la pestaña) o `null` si se guardó. */
  const guardar = useCallback(async (): Promise<"productos" | "entrega" | "servidor" | null> => {
    if (!pedido || !entrega || !entregaBase || soloLectura) return "servidor";
    if (guardandoRef.current) return "servidor";

    if (activas.length === 0) {
      setErrorGuardado("El pedido debe tener al menos un producto.");
      setEstadoGuardado("error");
      return "productos";
    }
    if (errores.size > 0) {
      setErrorGuardado("Revisa los productos marcados en rojo antes de guardar.");
      setEstadoGuardado("error");
      return "productos";
    }
    if (Object.keys(erroresEntrega).length > 0) {
      setErrorGuardado("Revisa los datos de entrega marcados en rojo.");
      setEstadoGuardado("error");
      return "entrega";
    }

    guardandoRef.current = true;
    setEstadoGuardado("cargando");
    setErrorGuardado(null);
    try {
      const respuesta = await editarPedido(
        pedido.id,
        construirPayload(lineas, entrega, entregaBase, pedido.fecha_modificacion)
      );
      aplicarPedido(respuesta.pedido);
      setEstadoGuardado("exito");
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(
        () => setEstadoGuardado((e) => (e === "exito" ? "inactivo" : e)),
        2400
      );
      void cargarEventos();
      onGuardado();
      return null;
    } catch (err) {
      const estado = (err as { response?: { status?: number } })?.response?.status;
      setConflicto(estado === 409);
      setErrorGuardado(extraerMensajeError(err, "No se pudo guardar el pedido."));
      setEstadoGuardado("error");
      return "servidor";
    } finally {
      guardandoRef.current = false;
    }
  }, [
    pedido,
    entrega,
    entregaBase,
    soloLectura,
    activas.length,
    errores.size,
    erroresEntrega,
    lineas,
    aplicarPedido,
    cargarEventos,
    onGuardado,
  ]);

  return {
    pedido,
    errorCarga,
    recargar,
    lineas,
    activas,
    entrega,
    entregaBase,
    eventos,
    errorEventos,
    cargarEventos,
    productos,
    productoPorId,
    categorias,
    unidades,
    catalogoCargado,
    base,
    cambios,
    errores,
    erroresEntrega,
    total,
    estadoGuardado,
    errorGuardado,
    conflicto,
    cambiarLinea,
    cambiarPresentacion,
    quitarLinea,
    restaurarLinea,
    revertirLinea,
    agregarLinea,
    cambiarEntrega,
    descartarCambios,
    guardar,
  };
}

export type GestionPedido = ReturnType<typeof useGestionPedido>;
