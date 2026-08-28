import type { NodoSidebar, Usuario } from "../types";
import { api, tokenStore } from "./client";

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
  otpToken: string
): Promise<VerifyResp> {
  const { data } = await api.post<VerifyResp>("/auth/verify-otp/", {
    otp_ticket: otpTicket,
    otp_token: otpToken,
  });
  tokenStore.set(data.access, data.refresh);
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
