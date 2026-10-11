/**
 * La salud del sistema, medida y no declarada.
 *
 * Cada servicio es una petición real con su latencia: `/healthz` dice si el
 * proceso vive, si la base de datos contesta y qué almacenamiento está activo;
 * el resto son endpoints de la API que el panel ya usa. Un «Operativo» aquí
 * significa que acaba de responder, no que alguien lo escribió.
 *
 * Lo que no tiene sonda —la mensajería, el correo— no aparece como sano: se
 * dice en la pantalla de integraciones que no hay forma de medirlo todavía.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/cliente";

export type EstadoServicio = "operativo" | "degradado" | "caido" | "comprobando";

export interface Servicio {
  id: string;
  nombre: string;
  detalle: string;
  estado: EstadoServicio;
  /** Milisegundos de la última comprobación. */
  latencia: number | null;
}

export interface Healthz {
  status: string;
  database: string;
  storage: "r2" | "local";
  r2_config?: Record<string, boolean>;
  storage_backend?: string;
}

interface Salud {
  servicios: Servicio[];
  healthz: Healthz | null;
  comprobadoEn: Date | null;
  comprobando: boolean;
  comprobar: () => Promise<void>;
  /** Servicios operativos sobre los medidos, de 0 a 1. */
  disponibilidad: number | null;
}

/** Más lento que esto se considera degradado aunque responda. */
const UMBRAL_LENTO = 2500;
const CADA = 60_000;

const BASE = import.meta.env.VITE_API_URL ?? "/api";
/** `/healthz` vive en la raíz del backend, no bajo `/api`. */
const URL_HEALTHZ = `${BASE.replace(/\/api\/?$/, "")}/healthz`;

const INICIALES: Servicio[] = [
  { id: "plataforma", nombre: "Plataforma", detalle: "Servidor de la aplicación", estado: "comprobando", latencia: null },
  { id: "base", nombre: "Base de datos", detalle: "PostgreSQL", estado: "comprobando", latencia: null },
  { id: "almacenamiento", nombre: "Almacenamiento", detalle: "Archivos e imágenes", estado: "comprobando", latencia: null },
  { id: "api", nombre: "API", detalle: "Autenticación y sesión", estado: "comprobando", latencia: null },
  { id: "suscripciones", nombre: "Suscripciones", detalle: "Motor comercial", estado: "comprobando", latencia: null },
  { id: "tiendas", nombre: "Motor de tiendas", detalle: "Plantillas y composición", estado: "comprobando", latencia: null },
];

async function medir<T>(peticion: () => Promise<T>): Promise<{ ok: boolean; ms: number; datos: T | null }> {
  const inicio = performance.now();
  try {
    const datos = await peticion();
    return { ok: true, ms: Math.round(performance.now() - inicio), datos };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - inicio), datos: null };
  }
}

function estadoDe(ok: boolean, ms: number): EstadoServicio {
  if (!ok) return "caido";
  return ms > UMBRAL_LENTO ? "degradado" : "operativo";
}

const Contexto = createContext<Salud | null>(null);

export function ProveedorSalud({ children }: { children: ReactNode }) {
  const [servicios, setServicios] = useState<Servicio[]>(INICIALES);
  const [healthz, setHealthz] = useState<Healthz | null>(null);
  const [comprobadoEn, setComprobadoEn] = useState<Date | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const enCurso = useRef(false);

  const comprobar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setComprobando(true);

    const [salud, me, subs, plantillas] = await Promise.all([
      medir(async () => {
        const r = await fetch(URL_HEALTHZ, { headers: { Accept: "application/json" } });
        const cuerpo = (await r.json().catch(() => null)) as Healthz | null;
        if (!r.ok && !cuerpo) throw new Error(String(r.status));
        return cuerpo;
      }),
      medir(() => api.get("/auth/me/")),
      medir(() => api.get("/platform/subscriptions/")),
      medir(() => api.get("/platform/templates/")),
    ]);

    const h = salud.datos;
    setHealthz(h);
    const r2Completo = h?.r2_config ? Object.values(h.r2_config).every(Boolean) : false;

    setServicios([
      {
        ...INICIALES[0],
        estado: salud.ok && h?.status === "ok" ? estadoDe(true, salud.ms) : "caido",
        latencia: salud.ms,
      },
      {
        ...INICIALES[1],
        estado: h?.database === "ok" ? "operativo" : "caido",
        latencia: h?.database === "ok" ? salud.ms : null,
      },
      {
        ...INICIALES[2],
        detalle: h?.storage === "r2" ? "Cloudflare R2" : h ? "Disco local del servidor" : INICIALES[2].detalle,
        // En disco local los archivos se pierden en cada despliegue de Render:
        // responde, pero no es un estado sano para producción.
        estado: !h ? "caido" : h.storage === "r2" && r2Completo ? "operativo" : "degradado",
        latencia: null,
      },
      { ...INICIALES[3], estado: estadoDe(me.ok, me.ms), latencia: me.ms },
      { ...INICIALES[4], estado: estadoDe(subs.ok, subs.ms), latencia: subs.ms },
      { ...INICIALES[5], estado: estadoDe(plantillas.ok, plantillas.ms), latencia: plantillas.ms },
    ]);
    setComprobadoEn(new Date());
    setComprobando(false);
    enCurso.current = false;
  }, []);

  useEffect(() => {
    void comprobar();
    const reloj = window.setInterval(() => void comprobar(), CADA);
    return () => window.clearInterval(reloj);
  }, [comprobar]);

  const valor = useMemo<Salud>(() => {
    const medidos = servicios.filter((s) => s.estado !== "comprobando");
    return {
      servicios,
      healthz,
      comprobadoEn,
      comprobando,
      comprobar,
      disponibilidad: medidos.length
        ? medidos.filter((s) => s.estado === "operativo").length / medidos.length
        : null,
    };
  }, [servicios, healthz, comprobadoEn, comprobando, comprobar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usarSalud(): Salud {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usarSalud necesita ProveedorSalud.");
  return valor;
}

export const ETIQUETA_SERVICIO: Record<EstadoServicio, string> = {
  operativo: "Operativo",
  degradado: "Degradado",
  caido: "Sin respuesta",
  comprobando: "Comprobando…",
};

export const TONO_SERVICIO = {
  operativo: "ok",
  degradado: "aviso",
  caido: "malo",
  comprobando: "neutro",
} as const;
