import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Home } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { tienePermiso } from "../../utils";
import { confirmarDescartar } from "../../utils/alertas";
import { InicioConfiguracion } from "./Inicio";
import { CATEGORIAS, PESTANAS_ANTIGUAS, type CategoriaConfig } from "./registro";
import { PendientesContexto } from "./ui";
import "./configuracion.css";

/**
 * El centro de configuración: un menú corto a la izquierda (cinco categorías)
 * y una sola vista a la vez a la derecha.
 *
 * Reemplaza a las doce pestañas horizontales de antes. La vista va en la URL
 * (`?seccion=negocio/identidad`) y las direcciones viejas (`?pestana=banners`)
 * se traducen, así que ningún enlace guardado se rompe.
 */
export function ConfiguracionPage() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Solo lo que esta persona puede ver; una categoría vacía no se muestra.
  const categorias = useMemo<CategoriaConfig[]>(
    () =>
      CATEGORIAS.map((c) => ({
        ...c,
        items: c.items.filter((i) => !i.permiso || tienePermiso(usuario ?? null, i.permiso)),
      })).filter((c) => c.items.length > 0),
    [usuario]
  );

  // Enlaces antiguos: ?pestana=banners → ?seccion=contenido/banners.
  useEffect(() => {
    const vieja = params.get("pestana");
    if (vieja && !params.get("seccion")) {
      setParams({ seccion: PESTANAS_ANTIGUAS[vieja] ?? "" }, { replace: true });
    }
  }, [params, setParams]);

  const pedida = params.get("seccion") ?? "";
  const categoriaActual = categorias.find((c) => c.items.some((i) => i.clave === pedida)) ?? null;
  const itemActual = categoriaActual?.items.find((i) => i.clave === pedida) ?? null;

  // ---------- cambios pendientes ----------
  const pendientes = useRef(new Set<string>());
  const [hayPendientes, setHayPendientes] = useState(false);
  const marcar = useCallback((clave: string, pendiente: boolean) => {
    if (pendiente) pendientes.current.add(clave);
    else pendientes.current.delete(clave);
    setHayPendientes(pendientes.current.size > 0);
  }, []);
  const contexto = useMemo(() => ({ marcar }), [marcar]);

  useEffect(() => {
    if (!hayPendientes) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayPendientes]);

  // Salir por un enlace (el menú lateral, la paleta de comandos…) con cambios
  // sin guardar también pregunta. El panel usa `BrowserRouter`, que no tiene
  // `useBlocker`; se intercepta el clic en fase de captura, antes que el Link.
  useEffect(() => {
    if (!hayPendientes) return;
    async function alHacerClic(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || enlace.target === "_blank" || enlace.origin !== window.location.origin) return;
      if (enlace.pathname + enlace.search === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      if (await confirmarDescartar("Si sales ahora, se perderán.")) {
        pendientes.current.clear();
        setHayPendientes(false);
        navegar(enlace.pathname + enlace.search + enlace.hash);
      }
    }
    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, [hayPendientes, navegar]);

  async function irA(clave: string | null) {
    if (clave === pedida || (clave === null && !pedida)) {
      setMenuAbierto(false);
      return;
    }
    if (hayPendientes && !(await confirmarDescartar("Si cambias de sección ahora, se perderán."))) return;
    pendientes.current.clear();
    setHayPendientes(false);
    setMenuAbierto(false);
    setParams(clave ? { seccion: clave } : {});
    document.querySelector(".main")?.scrollTo({ top: 0 });
  }

  const Vista = itemActual?.Vista;

  return (
    <PendientesContexto.Provider value={contexto}>
      <div className="topbar">
        <div className="cfg-titulo">
          <h1>Configuración</h1>
          {itemActual && categoriaActual && (
            <nav className="cfg-migas" aria-label="Ruta">
              <button type="button" onClick={() => irA(null)}>
                Inicio
              </button>
              <span aria-hidden>/</span>
              <button type="button" onClick={() => irA(categoriaActual.items[0].clave)}>
                {categoriaActual.titulo}
              </button>
              <span aria-hidden>/</span>
              <span aria-current="page">{itemActual.titulo}</span>
            </nav>
          )}
        </div>
      </div>

      <div className="contenido cfg">
        <aside className={`cfg-menu ${menuAbierto ? "abierto" : ""}`}>
          <button
            type="button"
            className="cfg-menu-alternar"
            aria-expanded={menuAbierto}
            aria-controls="cfg-menu-lista"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <span>{itemActual ? `${categoriaActual?.titulo} · ${itemActual.titulo}` : "Inicio de configuración"}</span>
            <ChevronDown size={16} aria-hidden />
          </button>
          <nav id="cfg-menu-lista" className="cfg-menu-lista" aria-label="Secciones de configuración">
            <button type="button" className={`cfg-menu-item ${!itemActual ? "activo" : ""}`} aria-current={!itemActual ? "page" : undefined} onClick={() => irA(null)}>
              <Home size={16} aria-hidden /> Inicio
            </button>
            {categorias.map((c) => {
              const Icono = c.icono;
              return (
                <div key={c.clave} className="cfg-menu-grupo">
                  <div className="cfg-menu-categoria">
                    <Icono size={13} aria-hidden /> {c.titulo}
                  </div>
                  {c.items.map((i) => (
                    <button
                      key={i.clave}
                      type="button"
                      className={`cfg-menu-item ${i.clave === pedida ? "activo" : ""}`}
                      aria-current={i.clave === pedida ? "page" : undefined}
                      onClick={() => irA(i.clave)}
                    >
                      {i.titulo}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="cfg-principal">
          {Vista ? <Vista key={pedida} /> : <InicioConfiguracion categorias={categorias} onIr={irA} />}
        </main>
      </div>
    </PendientesContexto.Provider>
  );
}
