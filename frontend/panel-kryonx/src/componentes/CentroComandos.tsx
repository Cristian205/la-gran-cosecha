/**
 * El Command Center (⌘K).
 *
 * La ruta corta a cualquier cosa: una empresa, un dominio, un plan, un usuario,
 * una sección o una acción. Tiene dos columnas con trabajos distintos:
 *
 * - A la izquierda, los ACCESOS RÁPIDOS: las acciones, lo último que se abrió
 *   y las secciones del panel. No cambian al escribir: son el sitio fijo al
 *   que se va sin pensar.
 * - A la derecha, las COINCIDENCIAS: sin escribir, sugerencias (lo reciente y
 *   las empresas); al escribir, lo que coincide en todo el catálogo, agrupado
 *   por tipo y con el texto encontrado resaltado.
 *
 * Busca sobre los catálogos que el panel ya tiene cargados, más dos que pide al
 * abrirse (plantillas y equipos). No hay endpoint de búsqueda y no se inventa
 * uno: cuando exista, lo que cambia es de dónde sale `todo`, no esta pantalla.
 */
import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Clock,
  CornerDownLeft,
  Globe,
  Layers,
  LayoutTemplate,
  Package,
  Plus,
  Receipt,
  Search,
  SearchX,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { tienda, type Plantilla } from "../api/tienda";
import { usarPlataforma } from "../datos/plataforma";
import { usarEquipos } from "../datos/equipos";
import { ETIQUETA_ESTADO, ETIQUETA_SUSCRIPCION } from "../datos/derivados";
import { DESTINOS } from "./navegacion";

type Familia =
  | "accion"
  | "ir"
  | "empresa"
  | "dominio"
  | "plan"
  | "permiso"
  | "producto"
  | "suscripcion"
  | "plantilla"
  | "usuario";

interface Resultado {
  id: string;
  familia: Familia;
  titulo: string;
  contexto: string;
  icono: ElementType;
  /** Ruta a la que lleva. Sin ruta, la fila informa y no se puede elegir. */
  destino?: string;
  buscable: string;
}

type Zona = "accesos" | "coincidencias";

const NOMBRE_FAMILIA: Record<Familia, string> = {
  accion: "Acciones",
  ir: "Secciones",
  empresa: "Empresas",
  dominio: "Dominios",
  plan: "Planes",
  permiso: "Permisos",
  producto: "Productos",
  suscripcion: "Suscripciones",
  plantilla: "Plantillas",
  usuario: "Usuarios",
};

/** Orden de los grupos en las coincidencias: lo que más se busca, primero. */
const ORDEN: Familia[] = [
  "empresa",
  "usuario",
  "suscripcion",
  "plan",
  "producto",
  "plantilla",
  "dominio",
  "ir",
  "accion",
  "permiso",
];

/** Cuántas filas enseña un grupo antes de "Ver todas": veinte permisos no
 *  pueden tapar la única empresa que coincide. */
const TOPE_GRUPO = 5;
const EMPRESAS_SUGERIDAS = 8;
const MAX_RECIENTES = 5;
const CLAVE_RECIENTES = "kryonx_comandos_recientes";

/** Normaliza para que "Perfumeria" encuentre "Perfumería". Conserva la
 *  longitud de cada letra precompuesta, así los índices sirven para resaltar
 *  sobre el texto original. */
function plano(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function esMac(): boolean {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
}

const ACCIONES: Resultado[] = [
  {
    id: "a-empresa",
    familia: "accion",
    titulo: "Crear empresa",
    contexto: "Alta de un cliente con su plan y su tienda",
    icono: Building2,
    destino: "/empresas?nueva=1",
    buscable: "crear nueva empresa cliente workspace alta",
  },
  {
    id: "a-producto",
    familia: "accion",
    titulo: "Crear producto",
    contexto: "Una solución nueva del catálogo",
    icono: Package,
    destino: "/productos?nuevo=1",
    buscable: "crear nuevo producto solución",
  },
  {
    id: "a-plantilla",
    familia: "accion",
    titulo: "Crear plantilla",
    contexto: "Un molde de tienda en el taller",
    icono: LayoutTemplate,
    destino: "/plantillas?nueva=1",
    buscable: "crear nueva plantilla template tienda",
  },
  {
    id: "a-usuario",
    familia: "accion",
    titulo: "Crear usuario",
    contexto: "Se crean desde el panel de cada empresa",
    icono: UserPlus,
    buscable: "crear nuevo usuario invitar",
  },
];

// ---------- Recientes (solo en este navegador) ----------

function leerRecientes(): string[] {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? "[]");
    return Array.isArray(crudo) ? crudo.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function guardarReciente(id: string) {
  try {
    const lista = [id, ...leerRecientes().filter((x) => x !== id)].slice(0, MAX_RECIENTES);
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento, sin recientes: no es un error */
  }
}

// ---------- Resaltado ----------

function Resaltado({ texto, consulta }: { texto: string; consulta: string }) {
  if (!consulta) return <>{texto}</>;
  const i = plano(texto).indexOf(consulta);
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + consulta.length)}</mark>
      {texto.slice(i + consulta.length)}
    </>
  );
}

// ---------- Componente ----------

export function CentroComandos({ onCerrar }: { onCerrar: () => void }) {
  const { negocios, planes, permisos, productos, suscripciones } = usarPlataforma();
  const { filas: miembros } = usarEquipos();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [consulta, setConsulta] = useState("");
  const [zona, setZona] = useState<Zona>("accesos");
  const [activo, setActivo] = useState(0);
  const [expandida, setExpandida] = useState<Familia | null>(null);
  const [recientes] = useState(leerRecientes);
  const navegar = useNavigate();
  const entrada = useRef<HTMLInputElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => entrada.current?.focus(), []);
  useEffect(() => {
    tienda.plantillas().then(setPlantillas).catch(() => setPlantillas([]));
  }, []);

  const todo = useMemo<Resultado[]>(() => {
    const filas: Resultado[] = [...ACCIONES];
    for (const d of DESTINOS) {
      filas.push({
        id: `ir${d.to}`,
        familia: "ir",
        titulo: d.etiqueta,
        contexto: d.pronto ? "Próximamente" : d.to,
        icono: d.icono,
        destino: d.to,
        buscable: `${d.etiqueta} ${d.sinonimos ?? ""}`,
      });
    }
    for (const n of negocios) {
      filas.push({
        id: `e${n.id}`,
        familia: "empresa",
        titulo: n.nombre,
        contexto: `${n.slug} · ${ETIQUETA_ESTADO[n.estado]}`,
        icono: Building2,
        destino: `/empresas/${n.id}`,
        buscable: `${n.nombre} ${n.slug}`,
      });
      for (const dominio of n.dominios) {
        filas.push({
          id: `d${n.id}${dominio}`,
          familia: "dominio",
          titulo: dominio,
          contexto: n.nombre,
          icono: Globe,
          destino: `/empresas/${n.id}/dominios`,
          buscable: `${dominio} ${n.nombre}`,
        });
      }
    }
    for (const s of suscripciones) {
      filas.push({
        id: `s${s.id}`,
        familia: "suscripcion",
        titulo: s.negocio,
        contexto: `${s.plan_nombre} · ${ETIQUETA_SUSCRIPCION[s.estado]}`,
        icono: Receipt,
        destino: `/empresas/${s.tenant}/suscripcion`,
        buscable: `${s.negocio} ${s.plan_nombre} suscripción`,
      });
    }
    for (const p of planes) {
      filas.push({
        id: `p${p.id}`,
        familia: "plan",
        titulo: p.nombre,
        contexto: `${p.negocios} ${p.negocios === 1 ? "empresa" : "empresas"}`,
        icono: Layers,
        destino: "/planes",
        buscable: `${p.nombre} ${p.slug}`,
      });
    }
    for (const p of productos) {
      filas.push({
        id: `r${p.id}`,
        familia: "producto",
        titulo: p.nombre,
        contexto: `${p.permisos} permisos · ${p.planes} planes`,
        icono: Package,
        destino: "/productos",
        buscable: `${p.nombre} ${p.slug} ${p.categoria}`,
      });
    }
    for (const p of plantillas) {
      filas.push({
        id: `t${p.id}`,
        familia: "plantilla",
        titulo: p.nombre,
        contexto: p.slug,
        icono: LayoutTemplate,
        destino: "/plantillas",
        buscable: `${p.nombre} ${p.slug}`,
      });
    }
    for (const m of miembros) {
      filas.push({
        id: `u${m.negocioId}${m.email}`,
        familia: "usuario",
        titulo: m.nombre || m.email,
        contexto: `${m.email} · ${m.negocio}`,
        icono: Users,
        destino: `/usuarios?q=${encodeURIComponent(m.email)}`,
        buscable: `${m.nombre} ${m.email} ${m.negocio} ${m.rol}`,
      });
    }
    for (const p of permisos) {
      filas.push({
        id: `m${p.id}`,
        familia: "permiso",
        titulo: p.etiqueta,
        contexto: `${p.modulo} · ${p.codename}`,
        icono: ShieldCheck,
        destino: "/permisos",
        buscable: `${p.etiqueta} ${p.modulo} ${p.codename}`,
      });
    }
    return filas;
  }, [negocios, planes, permisos, productos, suscripciones, plantillas, miembros]);

  const busqueda = plano(consulta.trim());

  // Lo reciente se guarda por id y se resuelve contra el catálogo actual: si
  // la empresa ya no existe, simplemente no aparece.
  const filasRecientes = useMemo(
    () => recientes.map((id) => todo.find((r) => r.id === id)).filter((r): r is Resultado => Boolean(r)),
    [recientes, todo]
  );

  // ---------- Columna izquierda: accesos rápidos ----------
  const gruposAccesos = useMemo(
    () =>
      [
        { clave: "accion", titulo: "Acciones", filas: todo.filter((r) => r.familia === "accion") },
        { clave: "recientes", titulo: "Recientes", filas: filasRecientes },
        { clave: "ir", titulo: "Ir a", filas: todo.filter((r) => r.familia === "ir") },
      ].filter((g) => g.filas.length > 0),
    [todo, filasRecientes]
  );

  // ---------- Columna derecha: coincidencias ----------
  const { gruposCoincidencias, totalCoincidencias } = useMemo(() => {
    if (!busqueda) {
      const sugerencias = [
        {
          clave: "empresa",
          titulo: "Empresas",
          familia: "empresa" as Familia,
          filas: todo.filter((r) => r.familia === "empresa").slice(0, EMPRESAS_SUGERIDAS),
          total: todo.filter((r) => r.familia === "empresa").length,
        },
        {
          clave: "plan",
          titulo: "Planes",
          familia: "plan" as Familia,
          filas: todo.filter((r) => r.familia === "plan").slice(0, TOPE_GRUPO),
          total: todo.filter((r) => r.familia === "plan").length,
        },
      ].filter((g) => g.filas.length > 0);
      return { gruposCoincidencias: sugerencias, totalCoincidencias: 0 };
    }
    const elegidos = todo.filter((r) => plano(`${r.titulo} ${r.contexto} ${r.buscable}`).includes(busqueda));
    // Primero lo que coincide en el título: es lo que se estaba buscando.
    const enTitulo = (r: Resultado) => (plano(r.titulo).includes(busqueda) ? 0 : 1);
    const grupos = ORDEN.map((familia) => {
      const delGrupo = elegidos.filter((r) => r.familia === familia).sort((a, b) => enTitulo(a) - enTitulo(b));
      return {
        clave: familia,
        titulo: NOMBRE_FAMILIA[familia],
        familia,
        filas: expandida === familia ? delGrupo : delGrupo.slice(0, TOPE_GRUPO),
        total: delGrupo.length,
      };
    }).filter((g) => g.total > 0);
    return { gruposCoincidencias: grupos, totalCoincidencias: elegidos.length };
  }, [todo, busqueda, expandida]);

  const filasDeZona = (z: Zona) =>
    (z === "accesos" ? gruposAccesos : gruposCoincidencias).flatMap((g) => g.filas).filter((r) => r.destino);
  const elegiblesAccesos = filasDeZona("accesos");
  const elegiblesCoincidencias = filasDeZona("coincidencias");
  const elegibles = zona === "accesos" ? elegiblesAccesos : elegiblesCoincidencias;

  // Al escribir, el foco del teclado pasa a las coincidencias; al borrar, vuelve
  // a los accesos rápidos.
  useEffect(() => {
    setZona(consulta.trim() ? "coincidencias" : "accesos");
    setActivo(0);
    setExpandida(null);
  }, [consulta]);

  useEffect(() => {
    const fila = cuerpo.current?.querySelector<HTMLElement>(".comandos__fila.esta-activa");
    fila?.scrollIntoView({ block: "nearest" });
  }, [activo, zona]);

  function ir(resultado: Resultado | undefined) {
    if (!resultado?.destino) return;
    guardarReciente(resultado.id);
    navegar(resultado.destino);
    onCerrar();
  }

  function cambiarZona() {
    const otra: Zona = zona === "accesos" ? "coincidencias" : "accesos";
    if (filasDeZona(otra).length === 0) return;
    setZona(otra);
    setActivo(0);
  }

  function alPulsar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, elegibles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Tab") {
      // El foco se queda en el buscador; Tab cambia de columna.
      e.preventDefault();
      cambiarZona();
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(elegibles[activo]);
    } else if (e.key === "Escape") {
      onCerrar();
    }
  }

  // Funciones de render, no componentes: declaradas aquí como componentes,
  // React las vería nuevas en cada render y desmontaría las filas al pasar el
  // ratón (y con ello se perdían clics).
  function fila(resultado: Resultado, enZona: Zona, key: string) {
    const lista = enZona === "accesos" ? elegiblesAccesos : elegiblesCoincidencias;
    const indice = lista.indexOf(resultado);
    const estaActiva = zona === enZona && indice === activo && indice >= 0;
    const Icono = resultado.icono;
    const esAccion = resultado.familia === "accion";
    const esReciente = enZona === "accesos" && recientes.includes(resultado.id) && !esAccion && resultado.familia !== "ir";
    return (
      <button
        key={key}
        type="button"
        role="option"
        aria-selected={estaActiva}
        aria-disabled={!resultado.destino}
        className={`comandos__fila ${estaActiva ? "esta-activa" : ""} ${resultado.destino ? "" : "es-informativa"}`}
        onMouseEnter={() => {
          if (indice < 0) return;
          setZona(enZona);
          setActivo(indice);
        }}
        onClick={() => ir(resultado)}
        title={resultado.destino ? undefined : resultado.contexto}
      >
        <span className={`comandos__icono ${esAccion ? "comandos__icono--accion" : ""}`}>
          {esAccion && resultado.destino ? <Plus size={14} /> : esReciente ? <Clock size={14} /> : <Icono size={15} />}
        </span>
        <span className="comandos__textos">
          <span className="comandos__titulo">
            <Resaltado texto={resultado.titulo} consulta={enZona === "coincidencias" ? busqueda : ""} />
          </span>
          {enZona === "coincidencias" && <span className="comandos__contexto">{resultado.contexto}</span>}
        </span>
        {resultado.destino && <ArrowRight size={14} className="comandos__flecha" />}
      </button>
    );
  }

  function grupo(key: string, titulo: string, children: ReactNode, extra?: ReactNode) {
    return (
      <div className="comandos__bloque" key={key}>
        <p className="comandos__grupo">
          <span>{titulo}</span>
          {extra}
        </p>
        {children}
      </div>
    );
  }

  // En <body>: la cabecera, donde se monta, tiene `backdrop-filter` y
  // `z-index: 30`. Lo primero hace que un `position: fixed` interno quede
  // acotado a la cabecera y no a la ventana; lo segundo lo deja por debajo de
  // la barra lateral. Así el velo oscurece y difumina TODA la pantalla.
  return createPortal(
    <div className="velo velo--alto velo--comandos" onMouseDown={onCerrar}>
      <div
        className="comandos comandos--dos"
        role="dialog"
        aria-modal="true"
        aria-label="Command Center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="comandos__entrada">
          <Search size={17} />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={alPulsar}
            placeholder="Busca empresas, usuarios, planes, dominios… o una sección"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="comandos-coincidencias"
          />
          {consulta && (
            <button
              type="button"
              className="comandos__borrar"
              onClick={() => {
                setConsulta("");
                entrada.current?.focus();
              }}
              aria-label="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
          <kbd>Esc</kbd>
        </div>

        <div className={`comandos__cuerpo ${busqueda ? "con-busqueda" : ""}`} ref={cuerpo}>
          <nav
            className={`comandos__accesos ${zona === "accesos" ? "esta-enfocada" : ""}`}
            aria-label="Accesos rápidos"
            role="listbox"
          >
            <p className="comandos__columna-titulo">Accesos rápidos</p>
            {gruposAccesos.map((g) => (
              grupo(g.clave, g.titulo, g.filas.map((r) => fila(r, "accesos", `${g.clave}-${r.id}`)))
            ))}
          </nav>

          <section
            className={`comandos__coincidencias ${zona === "coincidencias" ? "esta-enfocada" : ""}`}
            id="comandos-coincidencias"
            role="listbox"
            aria-label="Coincidencias"
          >
            <p className="comandos__columna-titulo" aria-live="polite">
              {busqueda ? (
                totalCoincidencias > 0 ? (
                  <>
                    <strong>{totalCoincidencias}</strong> coincidencia{totalCoincidencias === 1 ? "" : "s"}
                  </>
                ) : (
                  "Sin coincidencias"
                )
              ) : (
                "Sugerencias"
              )}
            </p>

            {busqueda && totalCoincidencias === 0 ? (
              <div className="comandos__vacio">
                <SearchX size={22} />
                <p>Nada coincide con «{consulta.trim()}».</p>
                <span>Prueba con el nombre, el identificador o el dominio de una empresa.</span>
              </div>
            ) : (
              <>
                {gruposCoincidencias.map((g) =>
                  grupo(
                    g.clave,
                    g.titulo,
                    <>
                      {g.filas.map((r) => fila(r, "coincidencias", r.id))}
                      {busqueda && g.total > TOPE_GRUPO && (
                        <button
                          type="button"
                          className="comandos__ver-mas"
                          onClick={() => {
                            setExpandida(expandida === g.familia ? null : g.familia);
                            entrada.current?.focus();
                          }}
                        >
                          <ChevronDown size={13} className={expandida === g.familia ? "girado" : ""} />
                          {expandida === g.familia ? "Ver menos" : `Ver todas (${g.total})`}
                        </button>
                      )}
                    </>,
                    busqueda ? (
                      <span className="comandos__grupo-cuenta">{g.total}</span>
                    ) : (
                      g.total > g.filas.length && (
                        <span className="comandos__grupo-cuenta">
                          {g.filas.length} de {g.total}
                        </span>
                      )
                    )
                  )
                )}
                {!busqueda && (
                  <p className="comandos__pista">
                    Escribe para buscar en empresas, usuarios, suscripciones, planes, productos, plantillas,
                    dominios y permisos.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <footer className="comandos__pie">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverse
          </span>
          <span className="comandos__pie-tab">
            <kbd>Tab</kbd> cambiar de columna
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={11} />
            </kbd>{" "}
            abrir
          </span>
          <span className="comandos__atajo">
            <kbd>{esMac() ? "⌘" : "Ctrl"}</kbd>
            <kbd>K</kbd> abrir o cerrar
          </span>
        </footer>
      </div>
    </div>,
    document.body
  );
}
