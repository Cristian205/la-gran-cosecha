import { api } from "./client";

export interface MensajeContactoInput {
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
}

export async function enviarMensajeContacto(
  datos: MensajeContactoInput
): Promise<void> {
  await api.post("/contact/messages/", datos);
}
