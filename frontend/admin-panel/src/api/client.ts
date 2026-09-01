import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

const ACCESS_KEY = "crynex_admin_access";
const REFRESH_KEY = "crynex_admin_refresh";

/**
 * Dónde viven los tokens, según lo que pidió quien entró.
 *
 * "Recordar sesión" es la diferencia entre `localStorage` —la sesión sobrevive
 * a cerrar el navegador— y `sessionStorage`, que se borra con la pestaña. Sin
 * esta distinción la casilla sería decorativa, y en un panel que se abre desde
 * ordenadores compartidos esa es justo la promesa que no se puede incumplir.
 *
 * Al leer se miran las dos: quien no marcó la casilla debe seguir dentro
 * mientras no cierre, y el interceptor no tiene por qué saber cuál se usó.
 */
function guardado(clave: string): string | null {
  return sessionStorage.getItem(clave) ?? localStorage.getItem(clave);
}

export const tokenStore = {
  getAccess: () => guardado(ACCESS_KEY),
  getRefresh: () => guardado(REFRESH_KEY),
  /** Si esta sesión se pidió recordar. */
  esPersistente: () => localStorage.getItem(REFRESH_KEY) !== null,
  set: (access: string, refresh?: string, recordar = true) => {
    const destino = recordar ? localStorage : sessionStorage;
    const otro = recordar ? sessionStorage : localStorage;
    // El almacén contrario se limpia primero: dos copias del mismo token
    // dejarían la sesión viva después de cerrar, que es lo contrario de lo
    // que se pidió.
    otro.removeItem(ACCESS_KEY);
    otro.removeItem(REFRESH_KEY);

    destino.setItem(ACCESS_KEY, access);
    if (refresh) destino.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    for (const almacen of [localStorage, sessionStorage]) {
      almacen.removeItem(ACCESS_KEY);
      almacen.removeItem(REFRESH_KEY);
    }
  },
};

export const api = axios.create({ baseURL });

// Adjunta el token de acceso a cada petición
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresca el token automáticamente ante un 401
let refreshing: Promise<string | null> | null = null;

async function refrescarToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh });
    // Se renueva donde ya estaba: un refresco no puede convertir en permanente
    // una sesión que se pidió temporal.
    tokenStore.set(data.access, data.refresh, tokenStore.esPersistente());
    return data.access as string;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      tokenStore.getRefresh()
    ) {
      original._retry = true;
      refreshing = refreshing ?? refrescarToken();
      const nuevo = await refreshing;
      refreshing = null;
      if (nuevo) {
        original.headers.Authorization = `Bearer ${nuevo}`;
        return api(original);
      }
      // Sesión expirada: redirige al login
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
