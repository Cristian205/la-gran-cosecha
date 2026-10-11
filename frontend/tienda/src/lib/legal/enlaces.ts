/**
 * Los enlaces legales del pie, en el orden y con los nombres que un comprador
 * busca. Viven aparte de `politicas.ts` para que el pie —que está en todas las
 * páginas— no arrastre al paquete del navegador el texto de nueve políticas.
 *
 * `grupo` separa lo que es la letra legal (términos, datos, privacidad,
 * cookies) de lo que el comprador consulta para resolver algo de su pedido
 * (envíos, devoluciones, pagos, PQRS): nueve enlaces en una sola lista pesan
 * demasiado, y en dos grupos con nombre se leen de un vistazo.
 */
export type GrupoLegal = "legal" | "ayuda";

export const ENLACES_LEGALES: { href: string; texto: string; grupo: GrupoLegal }[] = [
  { href: "/terminos-y-condiciones", texto: "Términos y condiciones", grupo: "legal" },
  { href: "/politica-tratamiento-datos", texto: "Tratamiento de datos personales", grupo: "legal" },
  { href: "/politica-de-privacidad", texto: "Política de privacidad", grupo: "legal" },
  { href: "/politica-de-cookies", texto: "Política de cookies", grupo: "legal" },
  { href: "/politica-de-envios", texto: "Envíos y entregas", grupo: "ayuda" },
  { href: "/cambios-y-devoluciones", texto: "Cambios y devoluciones", grupo: "ayuda" },
  { href: "/politica-de-retracto", texto: "Retracto", grupo: "ayuda" },
  { href: "/medios-de-pago", texto: "Medios de pago", grupo: "ayuda" },
  { href: "/contacto-y-peticiones", texto: "PQRS / Contacto", grupo: "ayuda" },
];
