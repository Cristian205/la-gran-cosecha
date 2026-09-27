import {
  Bell,
  ChevronDown,
  HelpCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sprout,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  resolverEstructura,
  type ContadorDeSeccion,
  type NodoSidebarResuelto,
  type SeccionDisponible,
} from "../sidebarConfig";
import { useTheme } from "../theme/ThemeContext";
import type { Estadisticas } from "../types";
import { SelectorNegocio } from "./SelectorNegocio";
import "./sidebar.css";

/**
 * La navegación del panel.
 *
 * QUÉ se muestra no vive aquí: vive en `sidebarConfig.ts` (secciones, rutas,
 * íconos, permisos, contadores) y en el `sidebar_layout` que cada usuario
 * puede personalizar. Este componente solo decide CÓMO se ve, en tres modos:
 *
 *   escritorio  completo, o contraído a íconos si la persona lo pidió
 *   tableta     siempre compacto (íconos con tooltip)
 *   móvil       fuera de pantalla; se abre como panel lateral desde la
 *               barra superior y se cierra al navegar, con Escape o tocando
 *               fuera
 *
 * Contraído, las etiquetas no desaparecen: quedan para el lector de
 * pantalla y se ven en un tooltip flotante (fuera del `<nav>`, para que el
 * scroll del menú no lo recorte).
 */
export type ModoSidebar = "escritorio" | "tableta" | "movil";

const TABLETA = "(max-width: 1024px)";
const MOVIL = "(max-width: 700px)";
const CLAVE_GRUPOS = "crynex-sidebar-grupos-cerrados";

export function useModoSidebar(): ModoSidebar {
  const leer = (): ModoSidebar =>
    window.matchMedia(MOVIL).matches ? "movil" : window.matchMedia(TABLETA).matches ? "tableta" : "escritorio";
  const [modo, setModo] = useState<ModoSidebar>(leer);
  useEffect(() => {
    const consultas = [window.matchMedia(MOVIL), window.matchMedia(TABLETA)];
    const alCambiar = () => setModo(leer());
    consultas.forEach((c) => c.addEventListener("change", alCambiar));
    return () => consultas.forEach((c) => c.removeEventListener("change", alCambiar));
  }, []);
  return modo;
}

function useGruposCerrados() {
  const [cerrados, setCerrados] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CLAVE_GRUPOS) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const alternar = useCallback((id: string) => {
    setCerrados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      localStorage.setItem(CLAVE_GRUPOS, JSON.stringify([...siguiente]));
      return siguiente;
    });
  }, []);
  return { cerrados, alternar };
}

interface Props {
  modo: ModoSidebar;
  colapsado: boolean;
  onAlternarColapso: () => void;
  abiertoEnMovil: boolean;
  onCerrarMovil: () => void;
  resumen: Estadisticas | null;
  noLeidas: number;
}

export function Sidebar({ modo, colapsado, onAlternarColapso, abiertoEnMovil, onCerrarMovil, resumen, noLeidas }: Props) {
  const { usuario, marca } = useAuth();
  const { tema, alternarTema } = useTheme();
  const { pathname } = useLocation();
  const raiz = useRef<HTMLElement>(null);
  const { cerrados, alternar } = useGruposCerrados();

  const compacto = modo === "tableta" || (modo === "escritorio" && colapsado);
  const estructura = useMemo(() => resolverEstructura(usuario?.sidebar_layout, usuario), [usuario]);

  const contador = useCallback(
    (clave?: ContadorDeSeccion) => (clave && resumen ? resumen[clave] ?? 0 : 0),
    [resumen]
  );

  // Móvil: navegar cierra el panel; Escape también, y el foco entra y sale con él.
  useEffect(() => {
    if (modo === "movil") onCerrarMovil();
    // Solo al cambiar de ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (modo !== "movil" || !abiertoEnMovil) return;
    const anterior = document.activeElement as HTMLElement | null;
    raiz.current?.querySelector<HTMLElement>(".sb-item.activo, .sb-item")?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrarMovil();
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      anterior?.focus?.();
    };
  }, [modo, abiertoEnMovil, onCerrarMovil]);

  const nombre = marca?.nombreEmpresa || "La Gran Cosecha";
  const oculto = modo === "movil" && !abiertoEnMovil;

  // Cerrado en móvil, el panel sigue en el DOM (para animar su entrada): `inert`
  // lo saca del orden de tabulación. Va por efecto porque React 18 no conoce
  // el atributo.
  useEffect(() => {
    if (raiz.current) raiz.current.inert = oculto;
  }, [oculto]);

  return (
    <>
      <aside
        ref={raiz}
        id="sidebar-principal"
        className={`sb ${compacto ? "sb--compacto" : ""} sb--${modo} ${abiertoEnMovil ? "sb--abierto" : ""}`}
        aria-label="Menú principal"
        aria-hidden={oculto || undefined}
      >
        <div className="sb-cabecera">
          <span className="sb-logo" aria-hidden={compacto ? undefined : true} data-tooltip={compacto ? nombre : undefined}>
            {marca?.logoUrl ? <img src={marca.logoUrl} alt="" /> : <Sprout size={20} />}
          </span>
          <span className="sb-marca">
            <strong>{nombre}</strong>
            <small>Panel administrativo</small>
          </span>
          {modo === "movil" && (
            <button type="button" className="sb-cerrar" onClick={onCerrarMovil} aria-label="Cerrar menú">
              <X size={18} />
            </button>
          )}
        </div>

        <SelectorNegocio colapsado={compacto} />

        <nav className="sb-nav" aria-label="Secciones">
          {estructura.map((nodo, i) => (
            <Nodo
              key={nodo.tipo === "item" ? nodo.seccion.clave : nodo.id}
              nodo={nodo}
              primero={i === 0}
              compacto={compacto}
              cerrado={nodo.tipo === "grupo" && !compacto && cerrados.has(nodo.id)}
              onAlternar={alternar}
              contador={contador}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="sb-pie">
          <div className="sb-dock" role="group" aria-label="Utilidades">
            <NavLink
              to="/notificaciones"
              className={({ isActive }) => `sb-dock-btn ${isActive ? "activo" : ""}`}
              data-tooltip="Notificaciones"
              aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
            >
              <Bell size={18} strokeWidth={1.9} />
              {noLeidas > 0 && (
                <span className="sb-dock-badge" aria-hidden="true">
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/ayuda"
              className={({ isActive }) => `sb-dock-btn ${isActive ? "activo" : ""}`}
              data-tooltip="Centro de ayuda"
              aria-label="Centro de ayuda"
            >
              <HelpCircle size={18} strokeWidth={1.9} />
            </NavLink>
            <button
              type="button"
              className="sb-dock-btn"
              onClick={alternarTema}
              data-tooltip={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              aria-label={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            >
              {tema === "oscuro" ? <Sun size={18} strokeWidth={1.9} /> : <Moon size={18} strokeWidth={1.9} />}
            </button>
          </div>

          {modo === "escritorio" && (
            <button
              type="button"
              className="sb-contraer"
              onClick={onAlternarColapso}
              aria-expanded={!colapsado}
              aria-controls="sidebar-principal"
              data-tooltip={colapsado ? "Expandir menú" : undefined}
            >
              {colapsado ? <PanelLeftOpen size={18} strokeWidth={1.9} /> : <PanelLeftClose size={18} strokeWidth={1.9} />}
              <span className="sb-label">{colapsado ? "Expandir menú" : "Contraer menú"}</span>
            </button>
          )}
        </div>
      </aside>

      {modo === "movil" && (
        <div className={`sb-velo ${abiertoEnMovil ? "sb-velo--visible" : ""}`} onClick={onCerrarMovil} aria-hidden="true" />
      )}
      <TooltipFlotante raiz={raiz} activo={compacto} />
    </>
  );
}

function Nodo({
  nodo,
  primero,
  compacto,
  cerrado,
  onAlternar,
  contador,
  pathname,
}: {
  nodo: NodoSidebarResuelto;
  primero: boolean;
  compacto: boolean;
  cerrado: boolean;
  onAlternar: (id: string) => void;
  contador: (c?: ContadorDeSeccion) => number;
  pathname: string;
}) {
  if (nodo.tipo === "item") {
    return (
      <ul className="sb-lista">
        <Item seccion={nodo.seccion} n={contador(nodo.seccion.badge)} compacto={compacto} />
      </ul>
    );
  }

  const idLista = `sb-grupo-${nodo.id}`;
  // Con el grupo cerrado, la sección activa no se ve: su título lo avisa.
  const contieneActiva = nodo.secciones.some((s) =>
    s.end ? pathname === s.to : pathname === s.to || pathname.startsWith(`${s.to}/`)
  );
  const pendientes = nodo.secciones.reduce((acc, s) => acc + contador(s.badge), 0);

  return (
    <div className={`sb-grupo ${primero ? "sb-grupo--primero" : ""}`}>
      {compacto ? (
        !primero && <span className="sb-separador" aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="sb-grupo-titulo"
          aria-expanded={!cerrado}
          aria-controls={idLista}
          onClick={() => onAlternar(nodo.id)}
        >
          <span>{nodo.titulo}</span>
          {cerrado && (contieneActiva || pendientes > 0) && (
            <span className="sb-grupo-aviso" aria-label={contieneActiva ? "Contiene la sección actual" : "Tiene pendientes"} />
          )}
          <ChevronDown size={14} className="sb-grupo-flecha" aria-hidden="true" />
        </button>
      )}
      <ul id={idLista} className="sb-lista" hidden={cerrado}>
        {nodo.secciones.map((s) => (
          <Item key={s.clave} seccion={s} n={contador(s.badge)} compacto={compacto} />
        ))}
      </ul>
    </div>
  );
}

function Item({ seccion, n, compacto }: { seccion: SeccionDisponible; n: number; compacto: boolean }) {
  const Icono = seccion.icon;
  const detalle = n > 0 && seccion.badgeTexto ? seccion.badgeTexto(n) : "";
  return (
    <li>
      <NavLink
        to={seccion.to}
        end={seccion.end}
        className={({ isActive }) => `sb-item ${isActive ? "activo" : ""}`}
        data-tooltip={compacto ? (detalle ? `${seccion.label} · ${detalle}` : seccion.label) : undefined}
      >
        <span className="sb-icono" aria-hidden="true">
          <Icono size={18} strokeWidth={1.9} />
          {compacto && n > 0 && <span className="sb-punto" />}
        </span>
        <span className="sb-label">{seccion.label}</span>
        {n > 0 && (
          <span className="sb-badge" aria-hidden={compacto || undefined}>
            {n > 99 ? "99+" : n}
          </span>
        )}
        {detalle && <span className="sb-sr">, {detalle}</span>}
      </NavLink>
    </li>
  );
}

/**
 * Un solo tooltip para todo el menú, en `position: fixed`: aparece al pasar el
 * cursor o al llegar con el teclado a un elemento con `data-tooltip`. Los del
 * dock salen siempre; los de las secciones, solo en modo compacto (expandido,
 * la etiqueta ya está a la vista).
 */
function TooltipFlotante({ raiz, activo }: { raiz: RefObject<HTMLElement>; activo: boolean }) {
  const [info, setInfo] = useState<{ texto: string; x: number; y: number; lateral: boolean } | null>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const mostrar = (e: Event) => {
      const objetivo = (e.target as HTMLElement).closest<HTMLElement>("[data-tooltip]");
      const enDock = Boolean(objetivo?.classList.contains("sb-dock-btn"));
      if (!objetivo || !el.contains(objetivo) || (!activo && !enDock)) {
        setInfo(null);
        return;
      }
      const r = objetivo.getBoundingClientRect();
      // Compacto: a la derecha del ícono. Expandido (solo el dock): encima.
      const lateral = activo;
      setInfo({
        texto: objetivo.dataset.tooltip ?? "",
        x: lateral ? r.right + 10 : r.left + r.width / 2,
        y: lateral ? r.top + r.height / 2 : r.top - 8,
        lateral,
      });
    };
    const ocultar = () => setInfo(null);
    el.addEventListener("mouseover", mostrar);
    el.addEventListener("focusin", mostrar);
    el.addEventListener("mouseleave", ocultar);
    el.addEventListener("focusout", ocultar);
    el.addEventListener("scroll", ocultar, true);
    return () => {
      el.removeEventListener("mouseover", mostrar);
      el.removeEventListener("focusin", mostrar);
      el.removeEventListener("mouseleave", ocultar);
      el.removeEventListener("focusout", ocultar);
      el.removeEventListener("scroll", ocultar, true);
    };
  }, [raiz, activo]);

  if (!info) return null;
  return (
    <div
      className={`sb-tooltip ${info.lateral ? "" : "sb-tooltip--arriba"}`}
      role="tooltip"
      style={{ left: info.x, top: info.y }}
    >
      {info.texto}
    </div>
  );
}
