import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

const ACCESS_KEY = "crynex_admin_access";
const REFRESH_KEY = "crynex_admin_refresh";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
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
    tokenStore.set(data.access, data.refresh);
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
