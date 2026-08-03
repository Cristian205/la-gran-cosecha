import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Megaphone, PackageCheck, PackagePlus, UserPlus } from "lucide-react";
import {
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
  obtenerNotificaciones,
} from "../api/notifications";
import type { Notificacion } from "../types";
import { formatoFecha } from "../utils";

const ICONOS: Record<Notificacion["tipo"], typeof Bell> = {
  PEDIDO_NUEVO: PackageCheck,
  CLIENTE_NUEVO: UserPlus,
  PRODUCTO_PERSONALIZADO: PackagePlus,
  SISTEMA: Megaphone,
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerNotificaciones()
      .then(setNotificaciones)
      .finally(() => setCargando(false));
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  async function abrir(n: Notificacion) {
    if (!n.leida) {
      setNotificaciones((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x))
      );
      marcarNotificacionLeida(n.id).catch(() => {});
    }
    if (n.enlace) navigate(n.enlace);
  }

  async function marcarTodas() {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    await marcarTodasLasNotificacionesLeidas().catch(() => {});
  }

  return (
    <>
      <div className="topbar">
        <h1>Centro de notificaciones</h1>
        <button className="btn secundario" onClick={marcarTodas} disabled={noLeidas === 0}>
          <CheckCheck size={16} /> Marcar todas como leídas
        </button>
      </div>

      <div className="contenido">
        <div className="panel">
          {cargando ? (
            <div className="vacio">Cargando…</div>
          ) : notificaciones.length === 0 ? (
            <div className="vacio">
              <Bell size={30} style={{ opacity: 0.5, marginBottom: ".5rem" }} />
              <div>No tienes notificaciones todavía.</div>
            </div>
          ) : (
            notificaciones.map((n) => {
              const Icono = ICONOS[n.tipo] ?? Bell;
              return (
                <div
                  key={n.id}
                  className={`notificacion-item ${!n.leida ? "no-leida" : ""}`}
                  onClick={() => abrir(n)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`notificacion-icono ${n.tipo}`}>
                    <Icono size={18} />
                  </span>
                  <div className="notificacion-detalle">
                    <div className="notificacion-titulo">
                      {n.titulo}
                      {!n.leida && <span className="notificacion-punto" />}
                    </div>
                    {n.mensaje && <div className="notificacion-mensaje">{n.mensaje}</div>}
                    <div className="notificacion-fecha">{formatoFecha(n.fecha_creacion)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
