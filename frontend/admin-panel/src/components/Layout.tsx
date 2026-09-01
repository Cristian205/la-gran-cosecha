import {
  Bell,
  ChevronDown,
  Clock,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sprout,
  Sun,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SelectorNegocio } from "./SelectorNegocio";
import { obtenerEstadisticas } from "../api/resources";
import { obtenerResumenNotificaciones } from "../api/notifications";
import { useTheme } from "../theme/ThemeContext";
import { CommandPalette } from "./CommandPalette";
import { resolverEstructura, type SeccionDisponible } from "../sidebarConfig";
import type { Estadisticas } from "../types";
import { formatoPrecio } from "../utils";

const REFRESCO_RESUMEN_MS = 120_000;
const REFRESCO_NOTIFICACIONES_MS = 60_000;

function SidebarLink({ seccion, sub }: { seccion: SeccionDisponible; sub?: boolean }) {
  return (
    <NavLink
      to={seccion.to}
      end={seccion.end}
      data-tooltip={seccion.label}
      className={({ isActive }) => `${sub ? "nav-sub-item" : ""} ${isActive ? "activo" : ""}`}
    >
      {({ isActive }) => (
        <>
          <seccion.icon size={19} strokeWidth={2} />
          <span className="nav-label">{seccion.label}</span>
          {isActive && <span className="nav-activo-marca" />}
        </>
      )}
    </NavLink>
  );
}

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
  const { usuario, marca, logout } = useAuth();
  const { tema, alternarTema } = useTheme();
  const navigate = useNavigate();

  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem("crynex-sidebar-colapsado") === "1"
  );
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [resumen, setResumen] = useState<Estadisticas | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const estructuraNav = useMemo(
    () => resolverEstructura(usuario?.sidebar_layout, usuario),
    [usuario?.sidebar_layout, usuario]
  );
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = estructuraNav.flatMap((n) => (n.tipo === "grupo" ? [n.id] : []));
    setGruposAbiertos(new Set(ids));
  }, [estructuraNav]);

  function alternarGrupo(id: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
      <aside className={`sidebar ${colapsado ? "colapsado" : ""}`}>
        <div className="marca">
          <span className="c">
            {marca?.logoUrl ? (
              <img src={marca.logoUrl} alt="" />
            ) : (
              <Sprout size={20} />
            )}
          </span>
          <span className="marca-texto">{marca?.nombreEmpresa || "La Gran Cosecha"}</span>
        </div>

        <SelectorNegocio colapsado={colapsado} />

        <nav>
          {estructuraNav.map((nodo) =>
            nodo.tipo === "item" ? (
              <SidebarLink key={nodo.seccion.clave} seccion={nodo.seccion} />
            ) : (
              <div className="nav-grupo" key={nodo.id}>
                {!colapsado && (
                  <button
                    type="button"
                    className="nav-grupo-btn"
                    onClick={() => alternarGrupo(nodo.id)}
                  >
                    <span className="nav-grupo-titulo">{nodo.titulo}</span>
                    <ChevronDown
                      size={14}
                      className={`chevron ${gruposAbiertos.has(nodo.id) ? "abierto" : ""}`}
                    />
                  </button>
                )}
                {(colapsado || gruposAbiertos.has(nodo.id)) &&
                  nodo.secciones.map((seccion) => (
                    <SidebarLink key={seccion.clave} seccion={seccion} sub />
                  ))}
              </div>
            )
          )}
        </nav>

        <div className="sidebar-pie">
          <div className="sidebar-iconos">
            <NavLink
              to="/notificaciones"
              className={({ isActive }) => `sidebar-icono-btn ${isActive ? "activo" : ""}`}
              data-tooltip="Notificaciones"
            >
              <span className="icono-con-badge">
                <Bell size={19} />
                {noLeidas > 0 && (
                  <span className="sidebar-badge">{noLeidas > 9 ? "9+" : noLeidas}</span>
                )}
              </span>
            </NavLink>

            <NavLink
              to="/ayuda"
              className={({ isActive }) => `sidebar-icono-btn ${isActive ? "activo" : ""}`}
              data-tooltip="Centro de ayuda"
            >
              <HelpCircle size={19} />
            </NavLink>

            <button
              type="button"
              className="sidebar-icono-btn"
              data-tooltip={tema === "oscuro" ? "Tema claro" : "Tema oscuro"}
              onClick={alternarTema}
            >
              {tema === "oscuro" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            data-tooltip={colapsado ? "Expandir menú" : "Contraer menú"}
            onClick={() => setColapsado((v) => !v)}
          >
            {colapsado ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            <span className="nav-label">
              {colapsado ? "Expandir menú" : "Contraer menú"}
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="navbar-global">
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
          >
            <Search size={15} />
            <span className="texto">Buscar…</span>
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
                  <Settings size={16} /> Configuración
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
