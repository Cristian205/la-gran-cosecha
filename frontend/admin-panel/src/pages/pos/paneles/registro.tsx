import type { ComponentType } from "react";
import type { Venta } from "../../../api/pos";
import { PanelCliente } from "./PanelCliente";
import { PanelReserva } from "./PanelReserva";

/**
 * Los paneles laterales de la caja, por clave.
 *
 * Es el mismo contrato que `bloques/registro.tsx` en la tienda, un piso más
 * abajo: el servidor NOMBRA el panel —`perfil.panel_lateral`, y la lista de
 * los disponibles según lo contratado— y este archivo dice qué componente lo
 * PINTA. Una clave sin componente no se pinta; un componente sin clave no se
 * puede elegir.
 *
 * Antes de esto, `PosPage` preguntaba literalmente `panel_lateral === "cliente"`.
 * Funcionaba con un panel y se rompía con dos: el segundo módulo habría
 * añadido una condición a la caja, que es justo lo que el registro del
 * servidor existe para evitar. Con el registro, el tercero es una fila aquí.
 */
export interface PropsDePanel {
  /** La venta en curso, si ya se abrió. Un panel se congela en cuanto existe:
   *  lo que aporta viajó con ella y cambiarlo después mentiría sobre el
   *  histórico. */
  venta: Venta | null;
  /** Lo elegido hasta ahora. Se manda al abrir la venta y acaba en su
   *  `contexto`, tal cual, sin que la caja lo interprete. */
  aporte: Record<string, unknown>;
  onAporte: (aporte: Record<string, unknown>) => void;
}

export interface PanelDelPOS {
  Componente: ComponentType<PropsDePanel>;
  /**
   * Qué hacer justo después de abrir la venta, si hace falta.
   *
   * Existe por un caso concreto: reservas necesita colgar la venta de la
   * reserva, y esa llamada es SUYA —va a `/reservas/…`—, no de la caja. Sin
   * este gancho, `PosPage` tendría que conocer el módulo, y volveríamos al
   * `if` que el registro elimina.
   */
  alAbrirVenta?: (venta: Venta, aporte: Record<string, unknown>) => Promise<void>;
}

export const PANELES: Record<string, PanelDelPOS> = {
  cliente: { Componente: PanelCliente },
  reserva: PanelReserva,
};

export function panelDelPerfil(clave: string | null | undefined): PanelDelPOS | null {
  if (!clave) return null;
  // Una clave desconocida no rompe la caja: se queda sin panel y se vende
  // igual. Es el mismo criterio que `tema.resolver()` con un token retirado.
  return PANELES[clave] ?? null;
}
