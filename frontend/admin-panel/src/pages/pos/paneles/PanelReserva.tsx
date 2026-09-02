import { useEffect, useState } from "react";
import {
  enlazarVenta,
  obtenerAgenda,
  obtenerConfiguracion,
  type Reserva,
} from "../../../api/reservas";
import type { PanelDelPOS, PropsDePanel } from "./registro";

/** Los estados que siguen esperando a alguien. Una cancelada o una cumplida no
 *  tienen nada que cobrar. */
const VIVAS = new Set(["PENDIENTE", "CONFIRMADA", "EN_CURSO"]);

function ventanaDelDia(): [string, string] {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return [inicio.toISOString(), fin.toISOString()];
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Cobrar sobre una reserva de hoy.
 *
 * Lo que el cajero elige aquí acaba en `Venta.contexto` sin que la caja lo
 * interprete —`{reserva_id, recurso_id, recurso_nombre}`—, y después
 * `alAbrirVenta` cuelga la venta de la reserva llamando a la API de ESTE
 * módulo. El POS no participa en ninguna de las dos cosas.
 *
 * El título sale de la configuración del negocio: «Mesa», «Cancha», «Silla».
 * Poner «Recurso» sería enseñarle al usuario la palabra del programador.
 */
function Panel({ venta, aporte, onAporte }: PropsDePanel) {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [nombre, setNombre] = useState("Mesa");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const [desde, hasta] = ventanaDelDia();
    void Promise.all([obtenerConfiguracion(), obtenerAgenda(desde, hasta)])
      .then(([config, delDia]) => {
        setNombre(config.nombre_recurso);
        setReservas(delDia.filter((r) => VIVAS.has(r.estado)));
      })
      .catch(() => setReservas([]))
      .finally(() => setCargando(false));
  }, []);

  const elegida = (aporte.reserva_id as number) ?? "";
  const enLaVenta = venta?.contexto?.reserva_id as number | undefined;

  if (venta && enLaVenta) {
    const suya = reservas.find((r) => r.id === enLaVenta);
    return (
      <div className="campo">
        <label>{nombre}</label>
        <p className="campo-ayuda">
          {suya
            ? `${suya.recurso_nombre} · ${suya.nombre_contacto} · ${hora(suya.inicio)}`
            : `Reserva #${enLaVenta}`}
        </p>
      </div>
    );
  }

  return (
    <div className="campo">
      <label>{nombre}</label>
      <select
        value={elegida}
        disabled={Boolean(venta)}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          const reserva = reservas.find((r) => r.id === id);
          onAporte(
            reserva
              ? {
                  reserva_id: reserva.id,
                  recurso_id: reserva.recurso,
                  // Copiado, no referenciado: dentro de dos años el histórico
                  // tiene que seguir diciendo en qué mesa se sentaron aunque
                  // el negocio haya renumerado el salón.
                  recurso_nombre: reserva.recurso_nombre,
                }
              : {}
          );
        }}
      >
        <option value="">Sin reserva</option>
        {reservas.map((r) => (
          <option key={r.id} value={r.id}>
            {r.recurso_nombre} · {hora(r.inicio)} · {r.nombre_contacto}
          </option>
        ))}
      </select>
      {!cargando && reservas.length === 0 && (
        <small className="campo-ayuda">No hay reservas para hoy.</small>
      )}
      {venta && (
        <small className="campo-ayuda">
          Se fija al abrir la venta. Anúlala si te equivocaste.
        </small>
      )}
    </div>
  );
}

export const PanelReserva: PanelDelPOS = {
  Componente: Panel,
  async alAbrirVenta(venta, aporte) {
    const id = aporte.reserva_id as number | undefined;
    if (!id) return;
    // Si esto falla, la venta ya existe y se puede cobrar igual: la reserva se
    // queda sin enlazar y alguien la cierra desde la agenda. Perder la venta
    // por no poder anotar la mesa sería mucho peor.
    try {
      await enlazarVenta(id, venta.id);
    } catch {
      /* la agenda queda sin marcar; la caja sigue */
    }
  },
};
