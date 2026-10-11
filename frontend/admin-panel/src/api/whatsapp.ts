import type { Paginated } from "../types";
import { api } from "./client";

/**
 * WhatsApp del negocio (backend: `apps.mensajeria`, guía en backend/WHATSAPP.md).
 *
 * Las credenciales de Meta y Twilio NO pasan por aquí: son de la plataforma y
 * viven en el servidor. El panel solo sabe si existen (`credenciales_plataforma`)
 * y edita lo que es de cada negocio.
 */

export type ProveedorWhatsApp = "META" | "TWILIO" | "SIMULADO";

export interface EventoWhatsApp {
  codigo: string;
  nombre: string;
  destinatario: "cliente" | "negocio";
  /** El evento en palabras del negocio: «Se confirma un pedido». */
  cuando?: string;
  variables: string[];
  texto: string;
}

export interface ConfiguracionWhatsApp {
  activo: boolean;
  proveedor: ProveedorWhatsApp;
  respaldo_activo: boolean;
  exige_consentimiento: boolean;
  meta_phone_number_id: string;
  twilio_remitente: string;
  telefonos_alertas: string[];
  eventos_apagados: string[];
  fecha_actualizacion: string;
  credenciales_plataforma: { meta: boolean; meta_webhook: boolean; twilio: boolean };
  eventos: EventoWhatsApp[];
}

export interface PlantillaWhatsApp {
  id: number;
  evento: string;
  meta_nombre: string;
  meta_idioma: string;
  twilio_content_sid: string;
  cuerpo: string;
  activa: boolean;
}

export type EstadoMensaje = "PENDIENTE" | "ENVIADO" | "ENTREGADO" | "LEIDO" | "FALLIDO" | "OMITIDO";

export interface MensajeWhatsApp {
  id: number;
  evento: string;
  destino: string;
  texto: string;
  estado: EstadoMensaje;
  proveedor: string;
  id_externo: string;
  error: string;
  intentos: { ronda: number; proveedor: string; ok: boolean; error: string; fecha: string }[];
  proximo_intento: string | null;
  pedido_id: number | null;
  fecha_creacion: string;
  fecha_envio: string | null;
}

export interface ExclusionWhatsApp {
  id: number;
  telefono: string;
  motivo: string;
  fecha: string;
}

function lista<T>(datos: Paginated<T> | T[]): T[] {
  return Array.isArray(datos) ? datos : datos.results;
}

export async function obtenerConfiguracion(): Promise<ConfiguracionWhatsApp> {
  return (await api.get<ConfiguracionWhatsApp>("/whatsapp/configuracion/")).data;
}

export async function guardarConfiguracion(
  cambios: Partial<Omit<ConfiguracionWhatsApp, "eventos" | "credenciales_plataforma" | "fecha_actualizacion">>
): Promise<ConfiguracionWhatsApp> {
  return (await api.patch<ConfiguracionWhatsApp>("/whatsapp/configuracion/", cambios)).data;
}

export async function obtenerPlantillas(): Promise<PlantillaWhatsApp[]> {
  return lista((await api.get<Paginated<PlantillaWhatsApp> | PlantillaWhatsApp[]>("/whatsapp/plantillas/")).data);
}

export async function crearPlantillasSugeridas(): Promise<PlantillaWhatsApp[]> {
  return (await api.post<PlantillaWhatsApp[]>("/whatsapp/plantillas/sugeridas/")).data;
}

export async function guardarPlantilla(plantilla: Omit<PlantillaWhatsApp, "id"> & { id?: number }): Promise<PlantillaWhatsApp> {
  const { id, ...datos } = plantilla;
  const respuesta = id
    ? await api.patch<PlantillaWhatsApp>(`/whatsapp/plantillas/${id}/`, datos)
    : await api.post<PlantillaWhatsApp>("/whatsapp/plantillas/", datos);
  return respuesta.data;
}

export async function obtenerMensajes(filtros: { estado?: string; evento?: string } = {}): Promise<MensajeWhatsApp[]> {
  const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
  return lista((await api.get<Paginated<MensajeWhatsApp> | MensajeWhatsApp[]>("/whatsapp/mensajes/", { params })).data);
}

export async function reintentarMensaje(id: number): Promise<MensajeWhatsApp> {
  return (await api.post<MensajeWhatsApp>(`/whatsapp/mensajes/${id}/reintentar/`)).data;
}

export async function enviarPrueba(evento: string, telefono: string): Promise<MensajeWhatsApp> {
  return (await api.post<MensajeWhatsApp>("/whatsapp/probar/", { evento, telefono })).data;
}

export async function obtenerExclusiones(): Promise<ExclusionWhatsApp[]> {
  return lista((await api.get<Paginated<ExclusionWhatsApp> | ExclusionWhatsApp[]>("/whatsapp/exclusiones/")).data);
}

export async function crearExclusion(telefono: string, motivo: string): Promise<ExclusionWhatsApp> {
  return (await api.post<ExclusionWhatsApp>("/whatsapp/exclusiones/", { telefono, motivo })).data;
}

export async function borrarExclusion(id: number): Promise<void> {
  await api.delete(`/whatsapp/exclusiones/${id}/`);
}
