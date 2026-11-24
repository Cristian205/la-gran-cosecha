import axios from "axios";
import type { NodoSidebar, Usuario } from "../types";
import { api, tokenStore } from "./client";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * «Dispositivo de confianza hasta medianoche» (backend: accounts/dispositivo.py).
 *
 * Tras confirmar el código del correo, el servidor puede devolver un testigo
 * que en ESTE navegador permite entrar el resto del día solo con la
 * contraseña. Se guarda por cuenta (correo en minúsculas): dos personas que
 * compartan el equipo no se prestan el testigo, y además el backend lo ata a
 * la persona. Vive en `localStorage` a propósito: tiene que sobrevivir a
 * cerrar sesión y a cerrar el navegador, que es justo cuando se vuelve a
 * entrar. Sin la contraseña no sirve de nada.
 */
const CLAVE_DISPOSITIVO = "kryonx_dispositivo_confiable";

function testigosGuardados(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function guardarTestigo(email: string, testigo: string | null) {
  try {
    const todos = testigosGuardados();
    const clave = email.trim().toLowerCase();
    if (testigo) todos[clave] = testigo;
    else delete todos[clave];
    localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(todos));
  } catch {
    /* sin almacenamiento: se pedirá el código cada vez, como antes */
  }
}

export interface LoginPaso1 {
  success: boolean;
  step: number;
  otp_ticket: string;
  message: string;
}

export interface VerifyResp {
  success: boolean;
  access: string;
  refresh: string;
  user: Usuario;
  /** Solo si se pidió confiar en el dispositivo. */
  dispositivo?: string;
  /** Entró sin código, con el dispositivo de confianza de hoy. */
  sin_codigo?: boolean;
}

/**
 * Paso 1. Si este navegador ya confirmó el código hoy para esta cuenta, el
 * servidor responde directamente con la sesión (`sin_codigo`) y no hay paso 2.
 */
export async function loginPaso1(
  email: string,
  password: string,
  /** Sin esto la sesión muere al cerrar el navegador. */
  recordar = true
): Promise<LoginPaso1 | VerifyResp> {
  const testigo = testigosGuardados()[email.trim().toLowerCase()];
  const { data } = await api.post<LoginPaso1 | VerifyResp>("/auth/login/", {
    email_usuario: email,
    password,
    ...(testigo ? { dispositivo: testigo } : {}),
  });
  if ("access" in data) {
    tokenStore.set(data.access, data.refresh, recordar);
  } else if (testigo) {
    // Pidió código pese a tener testigo: caducó (otro día, otra contraseña).
    guardarTestigo(email, null);
  }
  return data;
}

export async function verificarOtp(
  otpTicket: string,
  otpToken: string,
  /** Sin esto la sesión muere al cerrar el navegador. */
  recordar = true,
  /** No volver a pedir el código hoy en este navegador para esta cuenta. */
  confiar?: { email: string }
): Promise<VerifyResp> {
  const { data } = await api.post<VerifyResp>("/auth/verify-otp/", {
    otp_ticket: otpTicket,
    otp_token: otpToken,
    confiar_dispositivo: Boolean(confiar),
  });
  tokenStore.set(data.access, data.refresh, recordar);
  if (confiar) guardarTestigo(confiar.email, data.dispositivo ?? null);
  return data;
}

/**
 * Entra en otro de los negocios de la persona.
 *
 * El negocio activo viaja firmado dentro del token, así que no basta con
 * cambiar algo en el cliente: hay que pedir un par de tokens nuevo. El backend
 * vuelve a comprobar la pertenencia antes de emitirlo.
 */
export async function cambiarNegocio(slug: string): Promise<Usuario> {
  const { data } = await api.post<VerifyResp>("/auth/cambiar-negocio/", {
    negocio: slug,
  });
  tokenStore.set(data.access, data.refresh);
  return data.user;
}

export async function obtenerPerfil(): Promise<Usuario> {
  const { data } = await api.get<Usuario>("/auth/me/");
  return data;
}

export function cerrarSesion() {
  tokenStore.clear();
}

export async function guardarSidebarLayout(layout: NodoSidebar[]): Promise<Usuario> {
  const { data } = await api.patch<Usuario>("/auth/me/", { sidebar_layout: layout });
  return data;
}

export async function guardarNotificacionesSilenciadas(tipos: string[]): Promise<Usuario> {
  const { data } = await api.patch<Usuario>("/auth/me/", {
    notificaciones_silenciadas: tipos,
  });
  return data;
}

export async function cambiarPassword(
  passwordActual: string,
  passwordNueva: string
): Promise<void> {
  await api.post("/auth/change-password/", {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  });
}

/** El nombre propio, desde el perfil. El correo y el rol no se cambian aquí. */
export async function actualizarNombre(nombre: string): Promise<Usuario> {
  const { data } = await api.patch<Usuario>("/auth/me/", { nombre_usuario: nombre });
  return data;
}

// ---------- Restablecer la contraseña («¿Olvidó su contraseña?») ----------
// Sin sesión: van con `axios` directo y no con `api`, para que el interceptor
// no les ponga el token de una sesión anterior ni dispare un refresco.

export async function solicitarRestablecimiento(email: string): Promise<{ message: string; reset_ticket: string }> {
  const { data } = await axios.post(`${baseURL}/auth/password-reset/`, { email_usuario: email });
  return data;
}

export async function verificarCodigoRestablecimiento(resetTicket: string, codigo: string): Promise<{ cambio_ticket: string }> {
  const { data } = await axios.post(`${baseURL}/auth/password-reset/verificar/`, {
    reset_ticket: resetTicket,
    codigo,
  });
  return data;
}

export async function guardarPasswordRestablecida(cambioTicket: string, password: string): Promise<{ message: string }> {
  const { data } = await axios.post(`${baseURL}/auth/password-reset/nueva/`, {
    cambio_ticket: cambioTicket,
    password_nueva: password,
  });
  return data;
}
