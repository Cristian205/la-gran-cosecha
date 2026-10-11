/**
 * Los tipos de PQRS y su plazo legal de respuesta.
 *
 * Hoy la página los usa para armar el mensaje que el cliente envía por
 * WhatsApp o correo. Es también el contrato del formulario que vendrá: el día
 * que exista un modelo de PQRS en el backend (con radicado, estado y fecha
 * límite), el formulario enviará uno de estos `id` y el plazo saldrá de aquí.
 *
 * No se reutiliza `contact.MensajeContacto` a propósito: no guarda tipo ni
 * radicado, y una PQRS sin radicado no se puede seguir ni demostrar.
 */
export interface TipoPQRS {
  id: "peticion" | "queja" | "reclamo" | "solicitud" | "datos-personales" | "pedido";
  nombre: string;
  descripcion: string;
  ejemplo: string;
  plazo: string;
}

export const TIPOS_PQRS: TipoPQRS[] = [
  {
    id: "peticion",
    nombre: "Petición",
    descripcion: "Pides información, documentos o una actuación de nuestra parte.",
    ejemplo: "Quiero una copia de la factura de mi pedido.",
    plazo: "Hasta 15 días hábiles",
  },
  {
    id: "queja",
    nombre: "Queja",
    descripcion: "Nos cuentas tu inconformidad con la atención o el servicio recibido.",
    ejemplo: "El domiciliario no respetó la franja acordada.",
    plazo: "Hasta 15 días hábiles",
  },
  {
    id: "reclamo",
    nombre: "Reclamo",
    descripcion: "Exiges que corrijamos un incumplimiento: un producto defectuoso, un cobro o una garantía.",
    ejemplo: "Me cobraron un producto que no llegó.",
    plazo: "Hasta 15 días hábiles",
  },
  {
    id: "solicitud",
    nombre: "Solicitud o sugerencia",
    descripcion: "Nos propones una mejora o pides algo que hoy no ofrecemos.",
    ejemplo: "Me gustaría que entregaran también los sábados.",
    plazo: "Hasta 15 días hábiles",
  },
  {
    id: "datos-personales",
    nombre: "Datos personales",
    descripcion: "Quieres conocer, actualizar, corregir o eliminar tus datos, o revocar tu autorización.",
    ejemplo: "Quiero que eliminen mi número de teléfono de sus registros.",
    plazo: "Consultas: 10 días hábiles · Reclamos: 15 días hábiles",
  },
  {
    id: "pedido",
    nombre: "Sobre un pedido",
    descripcion: "Necesitas ayuda con un pedido en curso o ya entregado.",
    ejemplo: "Quiero agregar un producto a mi pedido de hoy.",
    plazo: "Lo antes posible dentro del horario de atención",
  },
];
