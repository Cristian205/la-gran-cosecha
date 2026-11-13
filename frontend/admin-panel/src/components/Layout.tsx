import { ChevronDown, Clock, LogOut, Menu, Search, Settings, User, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { obtenerEstadisticas } from "../api/resources";
import { obtenerResumenNotificaciones } from "../api/notifications";
import { ColumnasAjustables } from "./ColumnasAjustables";
import { CommandPalette } from "./CommandPalette";
import { Sidebar, useModoSidebar } from "./Sidebar";
import type { Estadisticas } from "../types";
import "./navbar.css";
import { formatoPrecio } from "../utils";

const REFRESCO_RESUMEN_MS = 120_000;
/** En Mac el atajo es ⌘K; en el resto, Ctrl K (el listener acepta ambos). */
const ATAJO = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
const REFRESCO_NOTIFICACIONES_MS = 60_000;

function iniciales(nombre?: string): string {
  if (!nombre) return "?";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** "GERENTE" → "Gerente": el rol se lee, no se grita. */
function rolLegible(rol?: string): string {
  if (!rol) return "";
  const t = rol.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem("kryonx-sidebar-colapsado") === "1"
  );
  const [menuAbierto, setMenuAbierto] = useState(false);
  const modo = useModoSidebar();
  const [menuMovil, setMenuMovil] = useState(false);
  const cerrarMenuMovil = useCallback(() => setMenuMovil(false), []);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [resumen, setResumen] = useState<Estadisticas | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("kryonx-sidebar-colapsado", colapsado ? "1" : "0");
  }, [colapsado]);

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAbierta(true);
      }
    }
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  useEffect(() => {
    let activo = true;
    function cargarResumen() {
      obtenerEstadisticas()
        .then((r) => {
          if (activo) setResumen(r);
        })
        .catch(() => {});
    }
    cargarResumen();
    const intervalo = setInterval(cargarResumen, REFRESCO_RESUMEN_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    let activo = true;
    function cargarNoLeidas() {
      obtenerResumenNotificaciones()
        .then((r) => {
          if (activo) setNoLeidas(r.no_leidas);
        })
        .catch(() => {});
    }
    cargarNoLeidas();
    const intervalo = setInterval(cargarNoLeidas, REFRESCO_NOTIFICACIONES_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("mousedown", alClickFuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alClickFuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, []);

  function salir() {
    logout();
    navigate("/login");
  }

  function irA(ruta: string) {
    setMenuAbierto(false);
    navigate(ruta);
  }

  return (
    <div className={`layout ${colapsado ? "sidebar-colapsada" : ""}`}>
      <Sidebar
        modo={modo}
        colapsado={colapsado}
        onAlternarColapso={() => setColapsado((v) => !v)}
        abiertoEnMovil={menuMovil}
        onCerrarMovil={cerrarMenuMovil}
        resumen={resumen}
        noLeidas={noLeidas}
      />

      <div className="main">
        <header className="navbar-global">
          {/* Izquierda: menú (móvil) e indicadores rápidos. */}
          <div className="navbar-zona navbar-zona--izq">
            {modo === "movil" && (
              <button
                type="button"
                className="navbar-menu-btn"
                onClick={() => setMenuMovil(true)}
                aria-label="Abrir menú"
                aria-expanded={menuMovil}
                aria-controls="sidebar-principal"
              >
                <Menu size={19} />
              </button>
            )}
            <button
              type="button"
              className="navbar-chip navbar-chip--caja"
              onClick={() => navigate("/")}
              aria-label={`Caja de hoy: ${resumen ? formatoPrecio(resumen.caja_hoy) : "cargando"}`}
              title="Caja de hoy"
            >
              <span className="navbar-chip-icono verde" aria-hidden="true">
                <Wallet size={15} />
              </span>
              <span className="navbar-chip-texto" aria-hidden="true">
                <span className="navbar-chip-label">Caja de hoy</span>
                <span className="navbar-chip-valor">{resumen ? formatoPrecio(resumen.caja_hoy) : "—"}</span>
              </span>
            </button>
            <button
              type="button"
              className={`navbar-chip ${resumen && resumen.pedidos_pendientes > 0 ? "navbar-chip--alerta" : ""}`}
              onClick={() => navigate("/pedidos")}
              aria-label={`Pedidos pendientes: ${resumen ? resumen.pedidos_pendientes : "cargando"}`}
              title="Pedidos pendientes"
            >
              <span className="navbar-chip-icono amber" aria-hidden="true">
                <Clock size={15} />
              </span>
              <span className="navbar-chip-texto" aria-hidden="true">
                <span className="navbar-chip-label">Pendientes</span>
                <span className="navbar-chip-valor">{resumen ? resumen.pedidos_pendientes : "—"}</span>
              </span>
            </button>
          </div>

          {/* Centro: el buscador global (abre la paleta, también con Ctrl/Cmd + K). */}
          <div className="navbar-zona navbar-zona--centro">
            <button
              type="button"
              className="navbar-buscar-btn"
              onClick={() => setPaletaAbierta(true)}
              aria-label={`Buscar pedidos, clientes o productos (${ATAJO})`}
              aria-haspopup="dialog"
            >
              <Search size={16} aria-hidden="true" />
              <span className="texto">Buscar pedidos, clientes o productos...</span>
              <kbd className="cmdk-atajo">{ATAJO}</kbd>
            </button>
          </div>

          {/* Derecha: perfil. */}
          <div className="navbar-zona navbar-zona--der">
            <div className="navbar-usuario" ref={menuRef}>
              <button
                type="button"
                className="navbar-usuario-btn"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                aria-label={`Cuenta de ${usuario?.nombre_usuario ?? "usuario"}`}
              >
                <span className="avatar" aria-hidden="true">{iniciales(usuario?.nombre_usuario)}</span>
                <span className="navbar-usuario-info">
                  <span className="n">{usuario?.nombre_usuario}</span>
                  <span className="r">{rolLegible(usuario?.rol_usuario)}</span>
                </span>
                <ChevronDown size={15} className={`chevron ${menuAbierto ? "abierto" : ""}`} aria-hidden="true" />
              </button>

              {menuAbierto && (
                <div className="menu-usuario" role="menu">
                  <div className="menu-usuario-cab">
                    <span className="avatar grande" aria-hidden="true">
                      {iniciales(usuario?.nombre_usuario)}
                    </span>
                    <div>
                      <div className="n">{usuario?.nombre_usuario}</div>
                      <div className="e">{usuario?.email_usuario}</div>
                      {usuario?.rol_usuario && <span className="menu-usuario-rol">{rolLegible(usuario.rol_usuario)}</span>}
                    </div>
                  </div>
                  <div className="menu-usuario-sep" />
                  <button type="button" role="menuitem" onClick={() => irA("/perfil")}>
                    <User size={16} /> Perfil
                  </button>
                  <button type="button" role="menuitem" onClick={() => irA("/configuracion")}>
                    <Settings size={16} /> Preferencias
                  </button>
                  <div className="menu-usuario-sep" />
                  <button type="button" role="menuitem" className="salir" onClick={salir}>
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Outlet />
        <ColumnasAjustables />
      </div>

      {paletaAbierta && <CommandPalette onCerrar={() => setPaletaAbierta(false)} />}
    </div>
  );
}
