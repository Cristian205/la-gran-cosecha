import axios from "axios";
import type { NodoSidebar, Usuario } from "../types";
import { api, tokenStore } from "./client";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export interface LoginPaso1 {
  success: boolean;
  step: number;
  otp_ticket: string;
  message: string;
}

export async function loginPaso1(
  email: string,
  password: string
): Promise<LoginPaso1> {
  const { data } = await api.post<LoginPaso1>("/auth/login/", {
    email_usuario: email,
    password,
  });
  return data;
}

export interface VerifyResp {
  success: boolean;
  access: string;
  refresh: string;
  user: Usuario;
}

export async function verificarOtp(
  otpTicket: string,
  otpToken: string,
  /** Sin esto la sesión muere al cerrar el navegador. */
  recordar = true
): Promise<VerifyResp> {
  const { data } = await api.post<VerifyResp>("/auth/verify-otp/", {
    otp_ticket: otpTicket,
    otp_token: otpToken,
  });
  tokenStore.set(data.access, data.refresh, recordar);
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
