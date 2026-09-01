/**
 * La tabla de clientes.
 *
 * Es la herramienta principal del panel, así que está construida para mil
 * empresas y no para las que hay hoy: se busca, se filtra, se ordena y se
 * pagina desde el primer día. Todo ocurre en memoria porque los catálogos de la
 * plataforma vienen enteros y sin paginar; el día que el backend pagine, lo que
 * cambia es de dónde salen las filas, no esta interfaz.
 *
 * El plan es una etiqueta, no un desplegable. Cambiarlo pasa por el menú de la
 * fila y por una confirmación que dice qué gana y qué pierde el cliente: es la
 * acción más cara de este panel y no puede ocurrir por rozar una celda.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutTemplate,
  PlayCircle,
  Receipt,
  Search,
} from "lucide-react";
import type { EstadoNegocio, Negocio } from "../api/tipos";
import {
  ETIQUETA_ESTADO,
  modulosDe,
  usoDe,
  razonDe,
  type Indicador,
} from "../datos/derivados";
import { numero, relativo } from "../datos/formato";
import { usarPlataforma } from "../datos/plataforma";
import { Boton, EstadoVacio, Esqueleto } from "../ui/basicos";
import { Menu, OpcionMenu, SeparadorMenu } from "../ui/Menu";
import { UsoEnLinea } from "../ui/Uso";
import { EstadoEmpresa, PlanEtiqueta } from "./piezas";
import { DialogoEstado, DialogoPlan } from "./dialogos";
import { DialogoPlantilla } from "./DialogoPlantilla";
import type { Plantilla } from "../api/tienda";

type Columna = "nombre" | "estado" | "plan" | "usuarios" | "renovacion";
type Sentido = "asc" | "desc";

const POR_PAGINA = 12;

const ESTADOS: EstadoNegocio[] = ["ACTIVO", "PRUEBA", "SUSPENDIDO", "ARCHIVADO"];

export function TablaEmpresas({
  negocios,
  cargando = false,
  compacta = false,
  /** Preselecciona el filtro cuando se llega desde una alerta. */
  soloAtencion = false,
  plantillas = [],
}: {
  negocios: Negocio[];
  cargando?: boolean;
  compacta?: boolean;
  soloAtencion?: boolean;
  /** Para la acción de aplicar plantilla. Vacío la oculta. */
  plantillas?: Plantilla[];
}) {
  const { planes, permisos, suscripcionDe, planDe } = usarPlataforma();
  const navegar = useNavigate();

  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<EstadoNegocio | "">("");
  const [plan, setPlan] = useState("");
  const [orden, setOrden] = useState<{ columna: Columna; sentido: Sentido }>({
    columna: "nombre",
    sentido: "asc",
  });
  const [pagina, setPagina] = useState(0);
  const [cambiandoPlan, setCambiandoPlan] = useState<Negocio | null>(null);
  const [cambiandoPlantilla, setCambiandoPlantilla] = useState<Negocio | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<{
    negocio: Negocio;
    estado: EstadoNegocio;
  } | null>(null);

  /** Todo lo que la fila necesita, calculado una vez por empresa. */
  const filas = useMemo(
    () =>
      negocios.map((negocio) => {
        const suscripcion = suscripcionDe(negocio.id);
        const suPlan = planDe(negocio);
        const indicadores = usoDe(negocio, suPlan, suscripcion);
        const usuarios = indicadores[0];
        // El indicador que más aprieta manda en la columna de uso: es el que
        // decide si esta empresa necesita algo.
        const tenso = indicadores.reduce<Indicador>(
          (peor, i) => ((razonDe(i) ?? -1) > (razonDe(peor) ?? -1) ? i : peor),
          indicadores[0]
        );
        return {
          negocio,
          suscripcion,
          usuarios,
          tenso,
          modulos: modulosDe(permisos, suPlan).filter((m) => m.concedidos.length > 0)
            .length,
          atencion:
            negocio.estado === "SUSPENDIDO" ||
            !negocio.plan ||
            suscripcion?.estado === "VENCIDA" ||
            suscripcion?.estado === "CANCELADA" ||
            (razonDe(tenso) ?? 0) >= 0.9,
        };
      }),
    [negocios, permisos, suscripcionDe, planDe]
  );

  const visibles = useMemo(() => {
    const busqueda = texto.trim().toLowerCase();
    const filtradas = filas.filter(({ negocio, atencion }) => {
      if (soloAtencion && !atencion) return false;
      if (estado && negocio.estado !== estado) return false;
      if (plan && negocio.plan?.slug !== plan) return false;
      if (!busqueda) return true;
      return (
        negocio.nombre.toLowerCase().includes(busqueda) ||
        negocio.slug.toLowerCase().includes(busqueda) ||
        negocio.dominios.some((d) => d.includes(busqueda))
      );
    });

    const signo = orden.sentido === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      switch (orden.columna) {
        case "estado":
          return signo * a.negocio.estado.localeCompare(b.negocio.estado);
        case "plan":
          return (
            signo *
            (a.negocio.plan?.nombre ?? "").localeCompare(b.negocio.plan?.nombre ?? "")
          );
        case "usuarios":
          return signo * (a.negocio.usuarios - b.negocio.usuarios);
        case "renovacion":
          return (
            signo *
            ((a.suscripcion?.fecha_fin ?? "9999").localeCompare(
              b.suscripcion?.fecha_fin ?? "9999"
            ))
          );
        default:
          return signo * a.negocio.nombre.localeCompare(b.negocio.nombre);
      }
    });
  }, [filas, texto, estado, plan, orden, soloAtencion]);

  const porPagina = compacta ? 6 : POR_PAGINA;
  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);
  const enPantalla = compacta
    ? visibles.slice(0, porPagina)
    : visibles.slice(actual * porPagina, actual * porPagina + porPagina);

  function ordenarPor(columna: Columna) {
    setOrden((previo) =>
      previo.columna === columna
        ? { columna, sentido: previo.sentido === "asc" ? "desc" : "asc" }
        : { columna, sentido: "asc" }
    );
    setPagina(0);
  }

  const th = (columna: Columna, etiqueta: string, clase = "") => (
    <th className={clase} aria-sort={orden.columna === columna ? (orden.sentido === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-orden" onClick={() => ordenarPor(columna)}>
        {etiqueta}
        <ChevronDown
          size={12}
          className={`th-orden__flecha ${
            orden.columna === columna ? `esta-activa ${orden.sentido}` : ""
          }`}
        />
      </button>
    </th>
  );

  if (cargando) return <EsqueletoTabla />;

  return (
    <>
      {!compacta && (
        <div className="filtros">
          <div className="filtros__buscar">
            <Search size={15} />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar por nombre, identificador o dominio…"
              aria-label="Buscar empresa"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoNegocio | "");
              setPagina(0);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPagina(0);
            }}
            aria-label="Filtrar por plan"
          >
            <option value="">Todos los planes</option>
            {planes.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nombre}
              </option>
            ))}
          </select>
          <span className="filtros__cuenta">
            {numero(visibles.length)} de {numero(filas.length)}
          </span>
        </div>
      )}

      {enPantalla.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo={
            filas.length === 0
              ? "Todavía no hay empresas"
              : "Ninguna empresa coincide"
          }
          accion={
            filas.length > 0 && (
              <Boton
                onClick={() => {
                  setTexto("");
                  setEstado("");
                  setPlan("");
                }}
              >
                Quitar los filtros
              </Boton>
            )
          }
        >
          {filas.length === 0
            ? "Cuando se dé de alta el primer cliente aparecerá aquí con su plan, su uso y sus dominios."
            : "Prueba con otro estado o con otro plan."}
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla">
            <thead>
              <tr>
                {th("nombre", "Cliente")}
                {!compacta && <th>Módulos</th>}
                {th("estado", "Estado")}
                {th("plan", "Plan")}
                <th>Uso</th>
                {th("usuarios", "Usuarios", "num")}
                {!compacta && th("renovacion", "Renovación")}
                <th className="col-acciones">
                  <span className="oculto">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {enPantalla.map(({ negocio, suscripcion, usuarios, tenso, modulos }) => (
                <tr
                  key={negocio.id}
                  className="fila-empresa"
                  onClick={() => navegar(`/empresas/${negocio.id}`)}
                >
                  <td>
                    <Link
                      to={`/empresas/${negocio.id}`}
                      className="empresa"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="empresa__inicial" aria-hidden="true">
                        {negocio.nombre.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <span className="empresa__nombre">{negocio.nombre}</span>
                        <code>{negocio.slug}</code>
                      </span>
                    </Link>
                  </td>

                  {!compacta && (
                    <td>
                      {modulos > 0 ? (
                        <span className="modulos-cuenta">
                          <Layers size={13} /> {modulos}
                        </span>
                      ) : (
                        <span className="tenue">—</span>
                      )}
                    </td>
                  )}

                  <td>
                    <EstadoEmpresa estado={negocio.estado} />
                  </td>

                  <td onClick={(e) => e.stopPropagation()}>
                    <PlanEtiqueta
                      nombre={negocio.plan?.nombre}
                      href={`/empresas/${negocio.id}/suscripcion`}
                    />
                  </td>

                  <td className="col-uso">
                    <UsoEnLinea indicador={tenso} />
                  </td>

                  <td className="num">
                    {numero(negocio.usuarios)}
                    {usuarios.limite !== null && (
                      <span className="tenue"> / {usuarios.limite}</span>
                    )}
                  </td>

                  {!compacta && (
                    <td>
                      {suscripcion?.fecha_fin ? (
                        relativo(suscripcion.fecha_fin)
                      ) : (
                        <span className="tenue">sin vencimiento</span>
                      )}
                    </td>
                  )}

                  <td className="col-acciones" onClick={(e) => e.stopPropagation()}>
                    <Menu etiqueta={`Acciones de ${negocio.nombre}`}>
                      {(cerrar) => (
                        <>
                          <OpcionMenu
                            icono={<ArrowRight size={14} />}
                            onClick={() => {
                              cerrar();
                              navegar(`/empresas/${negocio.id}`);
                            }}
                          >
                            Abrir la empresa
                          </OpcionMenu>
                          <OpcionMenu
                            icono={<Receipt size={14} />}
                            onClick={() => {
                              cerrar();
                              navegar(`/empresas/${negocio.id}/suscripcion`);
                            }}
                          >
                            Ver suscripción
                          </OpcionMenu>
                          <OpcionMenu
                            icono={<Layers size={14} />}
                            onClick={() => {
                              cerrar();
                              setCambiandoPlan(negocio);
                            }}
                          >
                            Cambiar de plan…
                          </OpcionMenu>
                          {plantillas.length > 0 && (
                            <OpcionMenu
                              icono={<LayoutTemplate size={14} />}
                              onClick={() => {
                                cerrar();
                                setCambiandoPlantilla(negocio);
                              }}
                            >
                              Aplicar plantilla…
                            </OpcionMenu>
                          )}
                          <SeparadorMenu />
                          {negocio.estado === "SUSPENDIDO" ? (
                            <OpcionMenu
                              icono={<PlayCircle size={14} />}
                              onClick={() => {
                                cerrar();
                                setCambiandoEstado({ negocio, estado: "ACTIVO" });
                              }}
                            >
                              Reactivar…
                            </OpcionMenu>
                          ) : (
                            <OpcionMenu
                              icono={<Ban size={14} />}
                              peligrosa
                              onClick={() => {
                                cerrar();
                                setCambiandoEstado({ negocio, estado: "SUSPENDIDO" });
                              }}
                            >
                              Suspender…
                            </OpcionMenu>
                          )}
                        </>
                      )}
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compacta && visibles.length > porPagina && (
        <nav className="paginacion" aria-label="Paginación">
          <span className="tenue">
            {actual * porPagina + 1}–{Math.min((actual + 1) * porPagina, visibles.length)} de{" "}
            {numero(visibles.length)}
          </span>
          <Boton
            tamano="pequeno"
            onClick={() => setPagina(actual - 1)}
            disabled={actual === 0}
            icono={<ChevronLeft size={14} />}
            aria-label="Página anterior"
          />
          <Boton
            tamano="pequeno"
            onClick={() => setPagina(actual + 1)}
            disabled={actual >= paginas - 1}
            icono={<ChevronRight size={14} />}
            aria-label="Página siguiente"
          />
        </nav>
      )}

      {cambiandoPlan && (
        <DialogoPlan negocio={cambiandoPlan} onCerrar={() => setCambiandoPlan(null)} />
      )}
      {cambiandoPlantilla && (
        <DialogoPlantilla
          negocio={cambiandoPlantilla}
          plantillas={plantillas}
          onCerrar={() => setCambiandoPlantilla(null)}
        />
      )}
      {cambiandoEstado && (
        <DialogoEstado
          negocio={cambiandoEstado.negocio}
          estado={cambiandoEstado.estado}
          onCerrar={() => setCambiandoEstado(null)}
        />
      )}
    </>
  );
}

function EsqueletoTabla() {
  return (
    <div className="marco-tabla">
      <div className="esqueleto-tabla">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="esqueleto-tabla__fila">
            <Esqueleto alto={28} ancho={28} radio={8} />
            <Esqueleto alto={12} ancho="26%" />
            <Esqueleto alto={12} ancho="14%" />
            <Esqueleto alto={12} ancho="18%" />
            <Esqueleto alto={12} ancho="10%" />
          </div>
        ))}
      </div>
    </div>
  );
}
