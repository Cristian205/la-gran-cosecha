/**
 * El estado de la plataforma, cargado una sola vez.
 *
 * Empresas, planes, permisos y suscripciones son cuatro catálogos cortos que
 * casi todas las pantallas necesitan a la vez: el resumen calcula el MRR con
 * los tres, la ficha de una empresa los cruza otra vez y las alertas viven de
 * la combinación. Pedirlos en cada página los descargaría cuatro veces y, peor,
 * dejaría que dos vistas mostraran versiones distintas del mismo plan.
 *
 * Las escrituras van contra la API y actualizan la copia local con lo que el
 * servidor devuelve, nunca con lo que el formulario suponía.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/cliente";
import type {
  DominioDetalle,
  EstadoNegocio,
  MiembroEquipo,
  Negocio,
  Permiso,
  Plan,
  PrecioPlan,
  Producto,
  Suscripcion,
  TipoLimite,
  UsuarioActual,
} from "../api/tipos";

interface Datos {
  negocios: Negocio[];
  planes: Plan[];
  permisos: Permiso[];
  productos: Producto[];
  tiposLimite: TipoLimite[];
  suscripciones: Suscripcion[];
  usuario: UsuarioActual | null;
}

interface Plataforma extends Datos {
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  suscripcionDe: (negocioId: number) => Suscripcion | null;
  planDe: (negocio: Negocio | null | undefined) => Plan | null;
  cambiarPlan: (negocio: Negocio, slug: string) => Promise<void>;
  cambiarEstado: (negocio: Negocio, estado: EstadoNegocio) => Promise<void>;
  crearPlan: (datos: Partial<Plan>) => Promise<Plan>;
  guardarPlan: (id: number, cambios: Partial<Plan>) => Promise<Plan>;
  archivarPlan: (plan: Plan) => Promise<void>;
  marcarPredeterminado: (plan: Plan) => Promise<Plan>;
  duplicarPlan: (
    plan: Plan,
    datos: { slug: string; nombre?: string; nueva_version?: boolean }
  ) => Promise<Plan>;
  crearPrecio: (planId: number, datos: Partial<PrecioPlan>) => Promise<PrecioPlan>;
  editarPrecio: (id: number, cambios: Partial<PrecioPlan>) => Promise<PrecioPlan>;
  crearPermiso: (datos: Partial<Permiso>) => Promise<Permiso>;
  guardarPermiso: (id: number, cambios: Partial<Permiso>) => Promise<Permiso>;
  crearProducto: (datos: Partial<Producto>) => Promise<Producto>;
  guardarProducto: (id: number, cambios: Partial<Producto>) => Promise<Producto>;
  archivarProducto: (producto: Producto) => Promise<void>;
  guardarSuscripcion: (
    id: number,
    cambios: Partial<Suscripcion>
  ) => Promise<Suscripcion>;
  /** Por empresa y bajo demanda: no son catálogos que casi toda pantalla use. */
  equipoDe: (negocioId: number) => Promise<MiembroEquipo[]>;
  dominiosDe: (negocioId: number) => Promise<DominioDetalle[]>;
}

const Contexto = createContext<Plataforma | null>(null);

const VACIO: Datos = {
  negocios: [],
  planes: [],
  permisos: [],
  productos: [],
  tiposLimite: [],
  suscripciones: [],
  usuario: null,
};

export function ProveedorPlataforma({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setError(null);
    try {
      const [negocios, planes, permisos, productos, tiposLimite, suscripciones, usuario] =
        await Promise.all([
          api.get<Negocio[]>("/platform/tenants/"),
          api.get<Plan[]>("/platform/plans/"),
          api.get<Permiso[]>("/platform/permissions/"),
          api.get<Producto[]>("/platform/products/"),
          api.get<TipoLimite[]>("/platform/limit-types/"),
          api.get<Suscripcion[]>("/platform/subscriptions/"),
          // El nombre para saludar. Si falla, el panel funciona igual: no es un
          // dato del que dependa ninguna decisión.
          api.get<UsuarioActual>("/auth/me/").catch(() => null),
        ]);
      setDatos({ negocios, planes, permisos, productos, tiposLimite, suscripciones, usuario });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const valor = useMemo<Plataforma>(() => {
    const porTenant = new Map(datos.suscripciones.map((s) => [s.tenant, s]));
    const porSlug = new Map(datos.planes.map((p) => [p.slug, p]));

    /** Reemplaza un elemento por id en cualquiera de los catálogos. */
    function reemplazar<T extends { id: number }>(lista: T[], nuevo: T): T[] {
      return lista.map((x) => (x.id === nuevo.id ? nuevo : x));
    }

    return {
      ...datos,
      cargando,
      error,
      recargar,

      suscripcionDe: (negocioId) => porTenant.get(negocioId) ?? null,
      planDe: (negocio) => (negocio?.plan ? porSlug.get(negocio.plan.slug) ?? null : null),

      async cambiarPlan(negocio, slug) {
        const suscripcion = await api.post<Suscripcion>(
          `/platform/tenants/${negocio.id}/cambiar-plan/`,
          { plan: slug }
        );
        const plan = porSlug.get(slug);
        setDatos((previos) => ({
          ...previos,
          negocios: previos.negocios.map((n) =>
            n.id === negocio.id
              ? {
                  ...n,
                  plan: plan ? { slug: plan.slug, nombre: plan.nombre } : n.plan,
                  estado_suscripcion: suscripcion.estado,
                }
              : n
          ),
          suscripciones: previos.suscripciones.some((s) => s.id === suscripcion.id)
            ? reemplazar(previos.suscripciones, suscripcion)
            : [...previos.suscripciones, suscripcion],
          // El contador de empresas por plan queda obsoleto en dos planes a la
          // vez; se recalcula en local para no pedir el catálogo entero.
          planes: previos.planes.map((p) => {
            if (p.slug === slug) return { ...p, negocios: p.negocios + 1 };
            if (p.slug === negocio.plan?.slug)
              return { ...p, negocios: Math.max(0, p.negocios - 1) };
            return p;
          }),
        }));
      },

      async cambiarEstado(negocio, estado) {
        const actualizado = await api.patch<Negocio>(
          `/platform/tenants/${negocio.id}/`,
          { estado }
        );
        setDatos((previos) => ({
          ...previos,
          negocios: reemplazar(previos.negocios, actualizado),
        }));
      },

      async crearPlan(datos) {
        const creado = await api.post<Plan>("/platform/plans/", datos);
        setDatos((previos) => ({ ...previos, planes: [...previos.planes, creado] }));
        return creado;
      },

      async guardarPlan(id, cambios) {
        const actualizado = await api.patch<Plan>(`/platform/plans/${id}/`, cambios);
        setDatos((previos) => ({
          ...previos,
          planes: reemplazar(previos.planes, actualizado),
        }));
        return actualizado;
      },

      /**
       * Retirar un plan es archivarlo, y eso lo decide el servidor.
       *
       * `DELETE` no borra cuando hay empresas dentro: cambia el estado a
       * ARCHIVADO. Se llama al mismo sitio en los dos casos para que la regla
       * viva en un lado solo, y se recarga porque la respuesta es 204.
       */
      async archivarPlan(plan) {
        await api.delete(`/platform/plans/${plan.id}/`);
        await recargar();
      },

      /**
       * El plan por defecto va por su propia accion y no por un PATCH.
       *
       * La base solo admite uno, asi que hay que apagar el anterior en la
       * misma operacion; un PATCH suelto chocaria contra la restriccion en
       * vez de hacer lo evidente.
       */
      async marcarPredeterminado(plan) {
        const actualizado = await api.post<Plan>(
          `/platform/plans/${plan.id}/predeterminado/`
        );
        setDatos((previos) => ({
          ...previos,
          planes: previos.planes.map((p) =>
            p.id === actualizado.id
              ? actualizado
              : p.es_predeterminado
                ? { ...p, es_predeterminado: false }
                : p
          ),
        }));
        return actualizado;
      },

      /**
       * Copia un plan, opcionalmente como su versión siguiente.
       *
       * Se recarga en vez de insertar la respuesta a mano porque, con
       * `nueva_version`, el original queda archivado en el mismo golpe —dos
       * filas cambian a la vez, y `recargar()` es lo único que las deja
       * consistentes sin duplicar esa regla aquí.
       */
      async duplicarPlan(plan, datos) {
        const copia = await api.post<Plan>(`/platform/plans/${plan.id}/duplicar/`, datos);
        await recargar();
        return copia;
      },

      async crearPrecio(planId, datos) {
        const creado = await api.post<PrecioPlan>(`/platform/plans/${planId}/precios/`, datos);
        setDatos((previos) => ({
          ...previos,
          planes: previos.planes.map((p) =>
            p.id === planId ? { ...p, precios: [...p.precios, creado] } : p
          ),
        }));
        return creado;
      },

      async editarPrecio(id, cambios) {
        const actualizado = await api.patch<PrecioPlan>(`/platform/prices/${id}/`, cambios);
        setDatos((previos) => ({
          ...previos,
          planes: previos.planes.map((p) =>
            p.id === actualizado.plan
              ? { ...p, precios: reemplazar(p.precios, actualizado) }
              : p
          ),
        }));
        return actualizado;
      },

      async crearPermiso(datos) {
        const creado = await api.post<Permiso>("/platform/permissions/", datos);
        setDatos((previos) => ({ ...previos, permisos: [...previos.permisos, creado] }));
        return creado;
      },

      async guardarPermiso(id, cambios) {
        const actualizado = await api.patch<Permiso>(
          `/platform/permissions/${id}/`,
          cambios
        );
        setDatos((previos) => ({
          ...previos,
          permisos: reemplazar(previos.permisos, actualizado),
        }));
        return actualizado;
      },

      async crearProducto(datos) {
        const creado = await api.post<Producto>("/platform/products/", datos);
        setDatos((previos) => ({ ...previos, productos: [...previos.productos, creado] }));
        return creado;
      },

      async guardarProducto(id, cambios) {
        const actualizado = await api.patch<Producto>(`/platform/products/${id}/`, cambios);
        setDatos((previos) => ({
          ...previos,
          productos: reemplazar(previos.productos, actualizado),
        }));
        return actualizado;
      },

      /** Igual que `archivarPlan`: `DELETE` archiva solo si tiene permisos vivos. */
      async archivarProducto(producto) {
        await api.delete(`/platform/products/${producto.id}/`);
        await recargar();
      },

      async guardarSuscripcion(id, cambios) {
        const actualizado = await api.patch<Suscripcion>(
          `/platform/subscriptions/${id}/`,
          cambios
        );
        setDatos((previos) => ({
          ...previos,
          suscripciones: reemplazar(previos.suscripciones, actualizado),
          negocios: previos.negocios.map((n) =>
            n.id === actualizado.tenant
              ? { ...n, estado_suscripcion: actualizado.estado }
              : n
          ),
        }));
        return actualizado;
      },

      equipoDe: (negocioId) => api.get<MiembroEquipo[]>(`/platform/tenants/${negocioId}/equipo/`),
      dominiosDe: (negocioId) =>
        api.get<DominioDetalle[]>(`/platform/tenants/${negocioId}/dominios/`),
    };
  }, [datos, cargando, error, recargar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarPlataforma(): Plataforma {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usarPlataforma necesita ProveedorPlataforma.");
  return valor;
}
