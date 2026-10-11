import type { SiteConfig } from "@/lib/tipos";
import type { DatosLegales, LegalGuardado, MetodoPago } from "./tipos";

/**
 * Los datos legales de la tienda, ya resueltos.
 *
 * Lo diligenciado en el centro legal manda. Lo que no, cae a lo que el negocio
 * ya escribió en su configuración —el correo, el teléfono, el NIT de la
 * factura— para no pedirle dos veces lo mismo. Y lo que no está en ninguna
 * parte se queda vacío: el texto lo enseña como «por completar». Nunca se
 * inventa un NIT, un plazo o una tarifa.
 */

/**
 * Los medios de pago que una tienda en Colombia suele ofrecer, todos SIN
 * confirmar (`activo: null`). La página los enseña como «por confirmar» hasta
 * que el negocio diga cuáles usa.
 */
export const METODOS_PAGO_BASE: MetodoPago[] = [
  {
    id: "en-linea",
    nombre: "Pago en línea",
    descripcion: "Tarjeta débito o crédito, PSE u otros medios a través de una pasarela de pagos.",
    activo: null,
  },
  {
    id: "transferencia",
    nombre: "Transferencia bancaria",
    descripcion: "Consignación o transferencia a la cuenta que te indiquemos al confirmar el pedido.",
    activo: null,
  },
  {
    id: "contraentrega",
    nombre: "Pago contra entrega",
    descripcion: "Pagas al recibir el pedido, en efectivo o por los medios que lleve quien entrega.",
    activo: null,
  },
];

/** Cómo se llama cada dato cuando falta: lo que se lee en «[NIT por completar]». */
export const ETIQUETAS: Record<string, string> = {
  nombre: "Nombre de la tienda",
  "empresa.razon_social": "Razón social",
  "empresa.nit": "NIT",
  "empresa.direccion": "Dirección",
  "empresa.ciudad": "Ciudad",
  "empresa.departamento": "Departamento",
  "empresa.representante_legal": "Representante legal",
  "empresa.matricula_mercantil": "Matrícula mercantil",
  "contacto.correo_atencion": "Correo de atención",
  "contacto.correo_datos_personales": "Correo para datos personales",
  "contacto.telefono": "Teléfono",
  "contacto.whatsapp": "WhatsApp",
  "contacto.horario_atencion": "Horario de atención",
  "contacto.direccion_notificaciones": "Dirección de notificaciones",
  "contacto.sitio_web": "Sitio web",
  "envios.cobertura": "Zonas de cobertura",
  "envios.horarios": "Horarios de entrega",
  "envios.tiempos": "Tiempos de entrega",
  "envios.costos": "Costos de envío",
  "envios.pedido_minimo": "Pedido mínimo",
  "envios.condiciones": "Condiciones especiales de entrega",
  "envios.perecederos": "Manejo de productos perecederos",
  "envios.retrasos": "Qué ocurre ante un retraso",
  "envios.confirmacion": "Cómo se confirma la entrega",
  "envios.requisitos": "Qué se necesita para recibir",
  "devoluciones.plazo_cambios": "Plazo para solicitar cambios",
  "devoluciones.plazo_reporte": "Plazo para reportar un producto defectuoso o incorrecto",
  "devoluciones.condiciones": "Condiciones del producto para cambio o devolución",
  "devoluciones.excepciones": "Productos sin cambio por su naturaleza",
  "devoluciones.reembolso": "Forma de reembolso",
  "devoluciones.costos_devolucion": "Quién asume el transporte de una devolución",
  "devoluciones.tiempo_respuesta": "Tiempo de respuesta a solicitudes",
  "pagos.confirmacion": "Cómo se confirma un pago",
  "pagos.seguridad": "Pasarela o entidad que procesa los pagos",
  "pedidos.ajuste_precio": "Qué ocurre si el cliente no acepta el precio final",
  "pedidos.cancelacion": "Condiciones para cancelar un pedido",
};

function primero(...valores: (string | undefined | null)[]): string | undefined {
  for (const v of valores) {
    const limpio = (v ?? "").trim();
    if (limpio) return limpio;
  }
  return undefined;
}

export function resolverDatos(
  config: SiteConfig,
  guardado: LegalGuardado | null,
  host: string
): DatosLegales {
  const g = guardado ?? {};
  const empresa = g.empresa ?? {};
  const contacto = g.contacto ?? {};

  const direccion = primero(empresa.direccion, config.direccion, config.factura_direccion);
  const correo = primero(contacto.correo_atencion, config.email);

  return {
    empresa: {
      ...empresa,
      nombre_comercial: primero(empresa.nombre_comercial, config.nombre_empresa),
      // El nombre que el negocio ya imprime en sus facturas es su razón social.
      razon_social: primero(empresa.razon_social, config.factura_proveedor),
      nit: primero(empresa.nit, config.factura_nit),
      direccion,
      ciudad: primero(empresa.ciudad, config.ciudad),
    },
    contacto: {
      ...contacto,
      correo_atencion: correo,
      correo_datos_personales: primero(contacto.correo_datos_personales, correo),
      telefono: primero(contacto.telefono, config.telefono, config.factura_telefono),
      whatsapp: primero(contacto.whatsapp, config.whatsapp_numero),
      horario_atencion: primero(contacto.horario_atencion, config.horario),
      direccion_notificaciones: primero(contacto.direccion_notificaciones, direccion),
      sitio_web: primero(contacto.sitio_web, host),
    },
    envios: { ...(g.envios ?? {}) },
    devoluciones: { ...(g.devoluciones ?? {}) },
    pagos: {
      ...(g.pagos ?? {}),
      metodos: g.pagos?.metodos?.length ? g.pagos.metodos : METODOS_PAGO_BASE,
    },
    pedidos: { ...(g.pedidos ?? {}) },
  };
}

/** El valor de `empresa.nit` (o de `nombre`) como texto, o `undefined` si falta. */
export function valorDe(datos: DatosLegales, ruta: string): string | undefined {
  if (ruta === "nombre") return datos.empresa.nombre_comercial;
  const [seccion, campo] = ruta.split(".") as [keyof DatosLegales, string];
  const bruto = (datos[seccion] as Record<string, unknown> | undefined)?.[campo];
  if (Array.isArray(bruto)) return bruto.length ? bruto.join(", ") : undefined;
  return typeof bruto === "string" && bruto.trim() ? bruto.trim() : undefined;
}

export type Segmento =
  | { tipo: "texto"; valor: string }
  | { tipo: "dato"; ruta: string; valor?: string }
  | { tipo: "enlace"; valor: string; href: string };

/**
 * Un dato `{{envios.costos}}` o un enlace interno `[Política de Cookies](/politica-de-cookies)`.
 * Solo enlaces que empiezan por `/`: un texto editable desde el panel no
 * debería poder sacar al cliente de la tienda.
 */
const MARCADOR = /\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}|\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** Parte un texto en trozos fijos y datos: "Escríbenos a {{contacto.correo_atencion}}". */
export function segmentar(texto: string, datos: DatosLegales): Segmento[] {
  const salida: Segmento[] = [];
  let ultimo = 0;
  for (const encontrado of texto.matchAll(MARCADOR)) {
    const inicio = encontrado.index ?? 0;
    if (inicio > ultimo) salida.push({ tipo: "texto", valor: texto.slice(ultimo, inicio) });
    if (encontrado[1]) {
      salida.push({ tipo: "dato", ruta: encontrado[1], valor: valorDe(datos, encontrado[1]) });
    } else {
      salida.push({ tipo: "enlace", valor: encontrado[2], href: encontrado[3] });
    }
    ultimo = inicio + encontrado[0].length;
  }
  if (ultimo < texto.length) salida.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return salida;
}

/** El mismo texto, plano: para metadatos y enlaces donde no cabe un marcador. */
export function textoPlano(texto: string, datos: DatosLegales): string {
  return segmentar(texto, datos)
    .map((s) => (s.tipo === "dato" ? s.valor ?? `[${ETIQUETAS[s.ruta] ?? s.ruta}]` : s.valor))
    .join("");
}

/** Cuántos datos de los que cita este conjunto de textos faltan por diligenciar. */
export function datosPendientes(textos: string[], datos: DatosLegales): string[] {
  const faltan = new Set<string>();
  for (const t of textos) {
    for (const s of segmentar(t, datos)) if (s.tipo === "dato" && !s.valor) faltan.add(s.ruta);
  }
  return [...faltan];
}

/** "2026-03-05" → "5 de marzo de 2026". Sin fecha, `null`: la página dice [FECHA]. */
export function fechaLegible(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
