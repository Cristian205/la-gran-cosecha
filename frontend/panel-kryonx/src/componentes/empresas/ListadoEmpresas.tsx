/**
 * El sistema de empresas: UNA lista con dos representaciones.
 *
 * Aquí viven los filtros, el orden, la página y los diálogos (cambiar plan,
 * aplicar plantilla, suspender). La tabla y las tarjetas solo pintan la lista
 * que les llega, así que cambiar de vista no pierde filtros ni página, y las
 * dos cuentan siempre lo mismo.
 *
 * Todo ocurre en memoria porque los catálogos de la plataforma vienen enteros
 * y sin paginar; el día que el backend pagine, lo que cambia es de dónde salen
 * las filas, no esta interfaz.
 */
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import type { EstadoNegocio, Negocio } from "../../api/tipos";
import type { Plantilla } from "../../api/tienda";
import { numero } from "../../datos/formato";
import { usarPlataforma } from "../../datos/plataforma";
import { Boton, EstadoVacio, Esqueleto } from "../../ui/basicos";
import { DialogoEstado, DialogoPlan } from "../dialogos";
import { DialogoPlantilla } from "../DialogoPlantilla";
import {
  FILTROS_VACIOS,
  filtrarEmpresas,
  hayFiltros,
  ordenarEmpresas,
  usarEmpresas,
  type Columna,
  type FiltrosEmpresas,
  type Orden,
} from "./modelo";
import { FiltrosEmpresasBarra, type ModoVista } from "./FiltrosEmpresas";
import { VistaTabla } from "./VistaTabla";
import { VistaTarjetas } from "./VistaTarjetas";
import type { ManejadoresAcciones } from "./piezas";

const POR_PAGINA = 12;
const CLAVE_VISTA = "kryonx_empresas_vista";

function vistaGuardada(): ModoVista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "tarjetas" ? "tarjetas" : "tabla";
  } catch {
    return "tabla";
  }
}

export function ListadoEmpresas({
  negocios,
  cargando = false,
  compacta = false,
  /** Preselecciona el filtro cuando se llega desde una alerta. */
  soloAtencion = false,
  plantillas = [],
}: {
  negocios: Negocio[];
  cargando?: boolean;
  /** La versión del Dashboard: solo tabla, sin filtros y seis filas. */
  compacta?: boolean;
  soloAtencion?: boolean;
  /** Para la acción de aplicar plantilla. Vacío la oculta. */
  plantillas?: Plantilla[];
}) {
  const { planes } = usarPlataforma();
  const empresas = usarEmpresas(negocios);

  const [filtros, setFiltros] = useState<FiltrosEmpresas>(FILTROS_VACIOS);
  const [orden, setOrden] = useState<Orden>({ columna: "nombre", sentido: "asc" });
  const [pagina, setPagina] = useState(0);
  const [vista, setVista] = useState<ModoVista>(vistaGuardada);

  const [cambiandoPlan, setCambiandoPlan] = useState<Negocio | null>(null);
  const [cambiandoPlantilla, setCambiandoPlantilla] = useState<Negocio | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<{ negocio: Negocio; estado: EstadoNegocio } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_VISTA, vista);
    } catch {
      /* sin almacenamiento, la vista no se recuerda: no es un error */
    }
  }, [vista]);

  const visibles = useMemo(
    () => ordenarEmpresas(filtrarEmpresas(empresas, filtros, soloAtencion), orden),
    [empresas, filtros, soloAtencion, orden]
  );

  const porPagina = compacta ? 6 : POR_PAGINA;
  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);
  const enPantalla = compacta
    ? visibles.slice(0, porPagina)
    : visibles.slice(actual * porPagina, actual * porPagina + porPagina);

  function cambiarFiltros(f: FiltrosEmpresas) {
    setFiltros(f);
    setPagina(0);
  }

  function ordenarPor(columna: Columna) {
    setOrden((previo) =>
      previo.columna === columna
        ? { columna, sentido: previo.sentido === "asc" ? "desc" : "asc" }
        : { columna, sentido: "asc" }
    );
    setPagina(0);
  }

  const acciones: ManejadoresAcciones = {
    onCambiarPlan: setCambiandoPlan,
    onAplicarPlantilla: plantillas.length > 0 ? setCambiandoPlantilla : undefined,
    onCambiarEstado: (negocio, estado) => setCambiandoEstado({ negocio, estado }),
  };

  const modo: ModoVista = compacta ? "tabla" : vista;

  return (
    <>
      {!compacta && (
        <FiltrosEmpresasBarra
          filtros={filtros}
          onCambiar={cambiarFiltros}
          planes={planes}
          visibles={visibles.length}
          total={empresas.length}
          vista={vista}
          onVista={setVista}
        />
      )}

      {cargando ? (
        modo === "tarjetas" ? <EsqueletoTarjetas /> : <EsqueletoTabla />
      ) : enPantalla.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo={empresas.length === 0 ? "Todavía no hay workspaces" : "Ninguna empresa coincide"}
          accion={
            empresas.length > 0 &&
            hayFiltros(filtros) && <Boton onClick={() => cambiarFiltros(FILTROS_VACIOS)}>Quitar los filtros</Boton>
          }
        >
          {empresas.length === 0
            ? "Cuando se dé de alta el primer cliente aparecerá aquí con su plan, su uso y sus dominios."
            : "Prueba con otra búsqueda, estado, plan o filtro."}
        </EstadoVacio>
      ) : modo === "tarjetas" ? (
        <VistaTarjetas empresas={enPantalla} acciones={acciones} />
      ) : (
        <VistaTabla empresas={enPantalla} orden={orden} onOrdenar={ordenarPor} compacta={compacta} acciones={acciones} />
      )}

      {!compacta && !cargando && visibles.length > porPagina && (
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

      {cambiandoPlan && <DialogoPlan negocio={cambiandoPlan} onCerrar={() => setCambiandoPlan(null)} />}
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

function EsqueletoTarjetas() {
  return (
    <ul className="emp-tarjetas" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <div className="emp-tarjeta emp-tarjeta--esqueleto">
            <Esqueleto alto={40} ancho={40} radio={10} />
            <Esqueleto alto={14} ancho="60%" />
            <Esqueleto alto={12} ancho="40%" />
            <Esqueleto alto={8} ancho="100%" />
            <Esqueleto alto={12} ancho="50%" />
          </div>
        </li>
      ))}
    </ul>
  );
}
