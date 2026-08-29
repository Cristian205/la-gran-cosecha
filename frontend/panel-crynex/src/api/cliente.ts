/**
 * Cliente de la API del panel de Crynex.
 *
 * Comparte el flujo de sesión con el panel de negocio —mismo login OTP, mismo
 * JWT— pero guarda el token con otra clave: son dos sesiones distintas y
 * mezclarlas dejaría entrar al panel de la plataforma con la sesión de una
 * empresa, que es justo lo que la separación del punto 9 evita.
 */
const BASE = import.meta.env.VITE_API_URL ?? "/api";

const ACCESO = "crynex_plataforma_access";
const REFRESCO = "crynex_plataforma_refresh";

export const sesion = {
  acceso: () => localStorage.getItem(ACCESO),
  refresco: () => localStorage.getItem(REFRESCO),
  guardar: (acceso: string, refresco?: string) => {
    localStorage.setItem(ACCESO, acceso);
    if (refresco) localStorage.setItem(REFRESCO, refresco);
  },
  cerrar: () => {
    localStorage.removeItem(ACCESO);
    localStorage.removeItem(REFRESCO);
  },
};

export class ErrorApi extends Error {
  constructor(
    public estado: number,
    public detalle: unknown,
    mensaje: string
  ) {
    super(mensaje);
  }
}

async function peticion<T>(
  ruta: string,
  opciones: RequestInit = {},
  reintentado = false
): Promise<T> {
  const token = sesion.acceso();
  const respuesta = await fetch(BASE + ruta, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  // Un token caducado se renueva una sola vez: si el reintento también da 401,
  // la sesión se acabó de verdad y insistir solo daría vueltas.
  if (respuesta.status === 401 && !reintentado && sesion.refresco()) {
    if (await renovar()) return peticion<T>(ruta, opciones, true);
    sesion.cerrar();
    window.location.href = "/";
  }

  if (respuesta.status === 204) return undefined as T;

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos,
      mensajeDe(datos) ?? `La petición falló (${respuesta.status})`
    );
  }
  return datos as T;
}

/** Saca el mensaje útil de las varias formas en que DRF reporta un error. */
function mensajeDe(datos: unknown): string | null {
  if (!datos || typeof datos !== "object") return null;
  const objeto = datos as Record<string, unknown>;
  if (typeof objeto.detail === "string") return objeto.detail;
  if (typeof objeto.message === "string") return objeto.message;
  const primero = Object.values(objeto)[0];
  if (Array.isArray(primero) && typeof primero[0] === "string") return primero[0];
  return null;
}

async function renovar(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: sesion.refresco() }),
    });
    if (!respuesta.ok) return false;
    const datos = await respuesta.json();
    sesion.guardar(datos.access, datos.refresh);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(ruta: string) => peticion<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) =>
    peticion<T>(ruta, { method: "POST", body: JSON.stringify(cuerpo ?? {}) }),
  patch: <T>(ruta: string, cuerpo: unknown) =>
    peticion<T>(ruta, { method: "PATCH", body: JSON.stringify(cuerpo) }),
  delete: <T>(ruta: string) => peticion<T>(ruta, { method: "DELETE" }),
};
