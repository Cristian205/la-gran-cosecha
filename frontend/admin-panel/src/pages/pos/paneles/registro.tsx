import type { ComponentType } from "react";
import type { Venta } from "../../../api/pos";
import { PanelCliente } from "./PanelCliente";
import { PanelDomicilio } from "./PanelDomicilio";
import { PanelReserva } from "./PanelReserva";

/**
 * Los paneles laterales de la caja, por clave.
 *
 * Es el mismo contrato que `bloques/registro.tsx` en la tienda, un piso más
 * abajo: el servidor NOMBRA los paneles —`perfil.panel_lateral`, y la lista de
 * los disponibles según lo contratado— y este archivo dice qué componente los
 * PINTA. Una clave sin componente no se pinta; un componente sin clave no se
 * puede elegir.
 *
 * Antes de esto, `PosPage` preguntaba literalmente `panel_lateral === "cliente"`.
 * Funcionaba con un panel y se rompía con dos: el segundo módulo habría
 * añadido una condición a la caja, que es justo lo que el registro del
 * servidor existe para evitar. Con el registro, el tercero es una fila aquí.
 *
 * Y domicilios —el segundo módulo de verdad— encontró el «uno» que quedaba:
 * `panel_lateral` era UNA clave, así que un restaurante que atiende mesas y
 * además reparte tenía que elegir cuál de sus dos módulos ver. Ahora son
 * varios, y `panelesDelPerfil` devuelve una lista.
 */
export interface PropsDePanel {
  /** La venta en curso, si ya se abrió. Un panel se congela en cuanto existe:
   *  lo que aporta viajó con ella y cambiarlo después mentiría sobre el
   *  histórico. */
  venta: Venta | null;
  /** Lo elegido hasta ahora POR ESTE PANEL. Cada uno tiene su propio trozo: si
   *  compartieran diccionario, el segundo en escribir borraría lo del primero,
   *  que es exactamente el fallo que aparece cuando dos paneles conviven. La
   *  caja los une al abrir la venta y el resultado acaba en su `contexto`, tal
   *  cual, sin que ella lo interprete. */
  aporte: Record<string, unknown>;
  onAporte: (aporte: Record<string, unknown>) => void;
}

export interface PanelDelPOS {
  Componente: ComponentType<PropsDePanel>;
  /**
   * Qué hacer justo después de abrir la venta, si hace falta.
   *
   * Existe por un caso concreto y ya lo usan dos módulos de formas opuestas:
   * reservas cuelga la venta de una reserva que ya existía, y domicilios crea
   * el envío en ese momento. Las dos llamadas son SUYAS —van a `/reservas/…` y
   * a `/domicilios/…`—, no de la caja. Sin este gancho, `PosPage` tendría que
   * conocer los módulos, y volveríamos al `if` que el registro elimina.
   */
  alAbrirVenta?: (venta: Venta, aporte: Record<string, unknown>) => Promise<void>;
}

export const PANELES: Record<string, PanelDelPOS> = {
  cliente: { Componente: PanelCliente },
  reserva: PanelReserva,
  domicilio: PanelDomicilio,
};

/**
 * Los paneles que este negocio pidió, en su orden y sin repetir.
 *
 * Acepta la CADENA SUELTA además de la lista, y no por generosidad:
 * `panel_lateral` fue una cadena hasta la fase 12 y puede llegar así desde un
 * perfil que nadie ha vuelto a guardar. Rechazarla dejaría a ese negocio sin su
 * panel —sin error, solo sin panel—, que es el peor modo de fallar.
 *
 * Una clave desconocida no rompe la caja: se descarta y se vende igual. Es el
 * mismo criterio que `tema.resolver()` con un token retirado.
 */
export function panelesDelPerfil(
  claves: string[] | string | null | undefined
): { clave: string; panel: PanelDelPOS }[] {
  if (!claves) return [];
  const lista = typeof claves === "string" ? [claves] : claves;
  const vistas = new Set<string>();
  const salida: { clave: string; panel: PanelDelPOS }[] = [];
  for (const clave of lista) {
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const panel = PANELES[clave];
    if (panel) salida.push({ clave, panel });
  }
  return salida;
}
