import { Bell, Megaphone, PackageCheck, PackagePlus, UserPlus } from "lucide-react";
import { useState } from "react";
import { guardarNotificacionesSilenciadas } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import type { Notificacion } from "../types";
import { extraerMensajeError } from "../utils";

const TIPOS: { tipo: Notificacion["tipo"]; etiqueta: string; icono: typeof Bell }[] = [
  { tipo: "PEDIDO_NUEVO", etiqueta: "Nuevo pedido", icono: PackageCheck },
  { tipo: "CLIENTE_NUEVO", etiqueta: "Nuevo cliente", icono: UserPlus },
  { tipo: "PRODUCTO_PERSONALIZADO", etiqueta: "Producto personalizado", icono: PackagePlus },
  { tipo: "SISTEMA", etiqueta: "Sistema / plataforma", icono: Megaphone },
];

export function NotificationPreferences() {
  const { usuario, setUsuario } = useAuth();
  const [silenciados, setSilenciados] = useState<Set<string>>(
    () => new Set(usuario?.notificaciones_silenciadas ?? [])
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function alternar(tipo: string) {
    setOk(false);
    setSilenciados((prev) => {
      const next = new Set(prev);
      next.has(tipo) ? next.delete(tipo) : next.add(tipo);
      return next;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const actualizado = await guardarNotificacionesSilenciadas([...silenciados]);
      setUsuario(actualizado);
      setOk(true);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar tus preferencias."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>
          <Bell size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
          Notificaciones
        </h2>
      </div>
      <div style={{ padding: "1.2rem" }}>
        {error && <div className="error-box">{error}</div>}
        {ok && <div className="ok-box">Preferencias guardadas correctamente.</div>}
        <p style={{ color: "var(--gris)", fontSize: ".85rem", marginTop: 0 }}>
          Elige qué tipos de notificación no quieres ver. Esta preferencia es solo tuya.
        </p>

        {TIPOS.map(({ tipo, etiqueta, icono: Icono }) => (
          <label
            key={tipo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".7rem",
              padding: ".6rem 0",
              borderBottom: "1px solid var(--borde)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={!silenciados.has(tipo)}
              onChange={() => alternar(tipo)}
              style={{ width: "auto" }}
            />
            <Icono size={16} />
            <span style={{ fontSize: ".88rem", fontWeight: 600 }}>{etiqueta}</span>
          </label>
        ))}

        <button
          type="button"
          className="btn primario"
          onClick={guardar}
          disabled={guardando}
          style={{ marginTop: "1rem" }}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
