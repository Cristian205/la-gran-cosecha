/**
 * La barra superior.
 *
 * Tres cosas y ninguna más: dónde estoy, buscar y quién soy. El resto de la
 * pantalla es para los datos. La ruta se lee del router en vez de que cada
 * página declare su migaja, para que no puedan desincronizarse.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, LogOut, RefreshCw, Search } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { iniciales } from "../datos/formato";
import { alertasDe } from "../datos/derivados";
import { Menu, OpcionMenu, SeparadorMenu } from "../ui/Menu";
import { BuscadorGlobal } from "./BuscadorGlobal";

const NOMBRE_RUTA: Record<string, string> = {
  empresas: "Empresas",
  planes: "Planes",
  permisos: "Permisos",
  suscripciones: "Suscripciones",
  plantillas: "Plantillas",
};

const NOMBRE_PESTANA: Record<string, string> = {
  suscripcion: "Suscripción",
  modulos: "Módulos",
  usuarios: "Usuarios",
  dominios: "Dominios",
  uso: "Uso",
  actividad: "Actividad",
};

function esMac(): boolean {
  return /mac/i.test(navigator.platform);
}

export function Cabecera({ alSalir }: { alSalir: () => void }) {
  const { negocios, planes, suscripciones, usuario, recargar } = usarPlataforma();
  const [buscando, setBuscando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscando(true);
      }
    };
    document.addEventListener("keydown", atajo);
    return () => document.removeEventListener("keydown", atajo);
  }, []);

  const migas = construirMigas(pathname, negocios);
  const pendientes = alertasDe(negocios, planes, suscripciones).length;

  async function refrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  return (
    <header className="cabecera">
      <nav className="migas" aria-label="Ruta">
        {migas.map((miga, i) => (
          <span key={miga.to ?? miga.texto}>
            {i > 0 && <span className="migas__sep">/</span>}
            {miga.to && i < migas.length - 1 ? (
              <Link to={miga.to}>{miga.texto}</Link>
            ) : (
              <span aria-current="page">{miga.texto}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="cabecera__acciones">
        <button
          type="button"
          className="buscar-disparador"
          onClick={() => setBuscando(true)}
        >
          <Search size={15} />
          <span>Buscar…</span>
          <kbd>{esMac() ? "⌘" : "Ctrl"} K</kbd>
        </button>

        <Link
          to="/empresas?filtro=atencion"
          className={`campana ${pendientes ? "tiene-pendientes" : ""}`}
          aria-label={`${pendientes} avisos que requieren atención`}
          data-pista="Requieren atención"
        >
          <AlertTriangle size={16} />
          {pendientes > 0 && <span className="campana__cuenta">{pendientes}</span>}
        </Link>

        <button
          type="button"
          className="icono-boton"
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
              <span className="usuario__nombre">
                {usuario?.nombre_usuario ?? "Cuenta"}
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

      {buscando && <BuscadorGlobal onCerrar={() => setBuscando(false)} />}
    </header>
  );
}

function construirMigas(
  pathname: string,
  negocios: { id: number; nombre: string }[]
): { texto: string; to?: string }[] {
  const partes = pathname.split("/").filter(Boolean);
  const migas: { texto: string; to?: string }[] = [
    { texto: "Control Center", to: "/" },
  ];
  if (partes.length === 0) {
    migas.push({ texto: "Resumen" });
    return migas;
  }

  migas.push({ texto: NOMBRE_RUTA[partes[0]] ?? partes[0], to: `/${partes[0]}` });

  if (partes[0] === "empresas" && partes[1]) {
    const negocio = negocios.find((n) => String(n.id) === partes[1]);
    migas.push({
      texto: negocio?.nombre ?? "Empresa",
      to: `/empresas/${partes[1]}`,
    });
    if (partes[2]) migas.push({ texto: NOMBRE_PESTANA[partes[2]] ?? partes[2] });
  }
  return migas;
}
