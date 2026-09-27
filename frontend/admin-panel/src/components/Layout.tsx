import { ChevronDown, Clock, LogOut, Menu, Search, Settings, User, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { obtenerEstadisticas } from "../api/resources";
import { obtenerResumenNotificaciones } from "../api/notifications";
import { CommandPalette } from "./CommandPalette";
import { Sidebar, useModoSidebar } from "./Sidebar";
import type { Estadisticas } from "../types";
import { formatoPrecio } from "../utils";

const REFRESCO_RESUMEN_MS = 120_000;
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

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem("crynex-sidebar-colapsado") === "1"
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
    localStorage.setItem("crynex-sidebar-colapsado", colapsado ? "1" : "0");
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
    document.addEventListener("mousedown", alClickFuera);
    return () => document.removeEventListener("mousedown", alClickFuera);
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
          {modo === "movil" && (
            <button
              type="button"
              className="navbar-menu-btn"
              onClick={() => setMenuMovil(true)}
              aria-label="Abrir menú"
              aria-expanded={menuMovil}
              aria-controls="sidebar-principal"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="navbar-resumen">
            <button type="button" className="navbar-chip" onClick={() => navigate("/")}>
              <span className="navbar-chip-icono verde">
                <Wallet size={15} />
              </span>
              <span className="navbar-chip-texto">
                <span className="navbar-chip-label">Caja de hoy</span>
                <span className="navbar-chip-valor">
                  {resumen ? formatoPrecio(resumen.caja_hoy) : "—"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="navbar-chip"
              onClick={() => navigate("/pedidos")}
            >
              <span className="navbar-chip-icono amber">
                <Clock size={15} />
              </span>
              <span className="navbar-chip-texto">
                <span className="navbar-chip-label">Pendientes</span>
                <span className="navbar-chip-valor">
                  {resumen ? resumen.pedidos_pendientes : "—"}
                </span>
              </span>
              {resumen && resumen.pedidos_pendientes > 0 && (
                <span className="navbar-chip-dot" />
              )}
            </button>
          </div>

          <button
            type="button"
            className="navbar-buscar-btn"
            onClick={() => setPaletaAbierta(true)}
            aria-label="Buscar en todo el panel (Ctrl K)"
          >
            <Search size={15} />
            <span className="texto">Buscar pedidos, clientes, productos…</span>
            <span className="cmdk-atajo">Ctrl K</span>
          </button>

          <div className="navbar-usuario" ref={menuRef}>
            <button
              type="button"
              className="navbar-usuario-btn"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              <span className="avatar">{iniciales(usuario?.nombre_usuario)}</span>
              <span className="navbar-usuario-info">
                <span className="n">{usuario?.nombre_usuario}</span>
                <span className="r">{usuario?.rol_usuario}</span>
              </span>
              <ChevronDown
                size={16}
                className={`chevron ${menuAbierto ? "abierto" : ""}`}
              />
            </button>

            {menuAbierto && (
              <div className="menu-usuario">
                <div className="menu-usuario-cab">
                  <span className="avatar grande">
                    {iniciales(usuario?.nombre_usuario)}
                  </span>
                  <div>
                    <div className="n">{usuario?.nombre_usuario}</div>
                    <div className="e">{usuario?.email_usuario}</div>
                  </div>
                </div>
                <div className="menu-usuario-sep" />
                <button type="button" onClick={() => irA("/perfil")}>
                  <User size={16} /> Perfil
                </button>
                <button type="button" onClick={() => irA("/configuracion")}>
                  <Settings size={16} /> Preferencias
                </button>
                <div className="menu-usuario-sep" />
                <button type="button" className="salir" onClick={salir}>
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <Outlet />
      </div>

      {paletaAbierta && <CommandPalette onCerrar={() => setPaletaAbierta(false)} />}
    </div>
  );
}
