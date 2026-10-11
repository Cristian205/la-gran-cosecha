/**
 * La barra superior.
 *
 * Dónde estoy (la marca y la ruta), buscar, qué requiere atención y quién soy.
 * El resto de la pantalla es para los datos. La ruta se lee del router y del
 * mapa de navegación en vez de que cada página declare su miga, para que no
 * puedan desincronizarse.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  LogOut,
  Menu as IconoMenu,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { iniciales } from "../datos/formato";
import { alertasDe } from "../datos/derivados";
import { usarMarca } from "../marca/ProveedorMarca";
import { Menu, OpcionMenu, SeparadorMenu } from "../ui/Menu";
import { Desplegable } from "../ui/Desplegable";
import { CentroComandos, esMac } from "./CentroComandos";
import { destinoDe } from "./navegacion";
import { LogoMarca } from "./SelectorMarca";

const NOMBRE_PESTANA: Record<string, string> = {
  suscripcion: "Suscripción",
  modulos: "Módulos",
  usuarios: "Usuarios",
  dominios: "Dominios",
  uso: "Uso",
  actividad: "Actividad",
  identidad: "Identidad",
};

export function Cabecera({ alSalir, alAbrirMenu }: { alSalir: () => void; alAbrirMenu: () => void }) {
  const { negocios, planes, suscripciones, usuario, recargar } = usarPlataforma();
  const { activa } = usarMarca();
  const [buscando, setBuscando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const { pathname } = useLocation();
  const navegar = useNavigate();

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscando((b) => !b);
      }
    };
    document.addEventListener("keydown", atajo);
    return () => document.removeEventListener("keydown", atajo);
  }, []);

  const migas = construirMigas(pathname, negocios);
  const alertas = alertasDe(negocios, planes, suscripciones);
  const criticas = alertas.filter((a) => a.nivel === "critico").length;

  async function refrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  return (
    <header className="cabecera">
      <div className="cabecera__inicio">
        <button
          type="button"
          className="icono-boton cabecera__menu"
          onClick={alAbrirMenu}
          aria-label="Abrir el menú"
        >
          <IconoMenu size={18} />
        </button>

        <nav className="migas" aria-label="Ruta">
          <Link to="/" className="migas__workspace" aria-label={`${activa.nombre}, ir al dashboard`}>
            <LogoMarca marca={activa} conNombre={false} />
            <span>{activa.nombre}</span>
          </Link>
          {migas.map((miga, i) => (
            <span key={`${miga.texto}${i}`} className="migas__paso">
              <span className="migas__sep" aria-hidden="true">/</span>
              {miga.to && i < migas.length - 1 ? (
                <Link to={miga.to}>{miga.texto}</Link>
              ) : (
                <span aria-current="page">{miga.texto}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="cabecera__acciones">
        <button
          type="button"
          className="buscar-disparador"
          onClick={() => setBuscando(true)}
          aria-label="Abrir el Command Center"
        >
          <Search size={15} />
          <span>Buscar…</span>
          <kbd>{esMac() ? "⌘" : "Ctrl"} K</kbd>
        </button>

        <Desplegable
          etiqueta={`Notificaciones: ${alertas.length} requieren atención`}
          ancho={340}
          claseDisparador={`campana ${alertas.length ? "tiene-pendientes" : ""} ${criticas ? "tiene-criticas" : ""}`}
          disparador={
            <>
              <Bell size={16} />
              {alertas.length > 0 && <span className="campana__cuenta">{alertas.length}</span>}
            </>
          }
        >
          {(cerrar) => (
            <div className="notificaciones">
              <header className="notificaciones__cabecera">
                <strong>Notificaciones</strong>
                <span className="tenue">
                  {alertas.length ? `${alertas.length} pendientes` : "Al día"}
                </span>
              </header>
              {alertas.length === 0 ? (
                <p className="notificaciones__vacio">
                  <CheckCircle2 size={16} /> Nada requiere atención ahora mismo.
                </p>
              ) : (
                <ul className="notificaciones__lista">
                  {alertas.slice(0, 6).map((alerta) => (
                    <li key={alerta.id}>
                      <Link
                        to={`/empresas/${alerta.negocioId}`}
                        className={`notificacion notificacion--${alerta.nivel}`}
                        onClick={cerrar}
                      >
                        <AlertTriangle size={14} />
                        <span>
                          <strong>{alerta.titulo}</strong>
                          <span className="tenue">{alerta.negocio}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="notificaciones__pie"
                onClick={() => {
                  cerrar();
                  navegar("/#acciones");
                }}
              >
                Abrir el Action Center
              </button>
            </div>
          )}
        </Desplegable>

        <button
          type="button"
          className="icono-boton cabecera__recargar"
          onClick={refrescar}
          disabled={refrescando}
          aria-label="Recargar los datos"
          data-pista="Recargar"
        >
          <RefreshCw size={15} className={refrescando ? "girando" : undefined} />
        </button>

        <Menu
          etiqueta="Tu cuenta"
          disparador={
            <span className="usuario">
              <span className="usuario__avatar" aria-hidden="true">
                {iniciales(usuario?.nombre_usuario ?? "?")}
              </span>
              <span className="usuario__textos">
                <span className="usuario__nombre">{usuario?.nombre_usuario ?? "Cuenta"}</span>
                <span className="usuario__rol">Administrador</span>
              </span>
            </span>
          }
        >
          {(cerrar) => (
            <>
              <p className="menu__encabezado">
                <strong>{usuario?.nombre_usuario ?? "Sesión activa"}</strong>
                <span className="tenue">{usuario?.email_usuario}</span>
              </p>
              <SeparadorMenu />
              <OpcionMenu
                icono={<Settings size={14} />}
                onClick={() => {
                  cerrar();
                  navegar("/ajustes");
                }}
              >
                Ajustes
              </OpcionMenu>
              <OpcionMenu
                icono={<LogOut size={14} />}
                peligrosa
                onClick={() => {
                  cerrar();
                  alSalir();
                }}
              >
                Cerrar sesión
              </OpcionMenu>
            </>
          )}
        </Menu>
      </div>

      {buscando && <CentroComandos onCerrar={() => setBuscando(false)} />}
    </header>
  );
}

function construirMigas(
  pathname: string,
  negocios: { id: number; nombre: string }[]
): { texto: string; to?: string }[] {
  const encontrado = destinoDe(pathname);
  if (!encontrado) return [{ texto: "Dashboard" }];
  const { destino } = encontrado;
  const migas: { texto: string; to?: string }[] = [{ texto: destino.etiqueta, to: destino.to }];

  const partes = pathname.split("/").filter(Boolean);
  if (partes[0] === "empresas" && partes[1]) {
    const negocio = negocios.find((n) => String(n.id) === partes[1]);
    migas.push({ texto: negocio?.nombre ?? "Empresa", to: `/empresas/${partes[1]}` });
    if (partes[2]) migas.push({ texto: NOMBRE_PESTANA[partes[2]] ?? partes[2] });
  }
  return migas;
}
