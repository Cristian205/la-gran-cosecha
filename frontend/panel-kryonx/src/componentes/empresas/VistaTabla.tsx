/**
 * La vista administrativa: comparar empresas de un vistazo.
 *
 * La columna Cliente manda (logo, nombre, identificador y alta); el resto son
 * datos cortos alineados para leerse en vertical. En móvil la tabla se
 * convierte en filas compactas (`tabla--tarjetas`), sin scroll horizontal.
 */
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { relativo } from "../../datos/formato";
import { EstadoEmpresa, PlanEtiqueta } from "../piezas";
import type { Columna, Empresa, Orden } from "./modelo";
import {
  AccionesEmpresa,
  IdentidadEmpresa,
  ModulosEmpresa,
  SaludEmpresa,
  UsoEmpresa,
  UsuariosEmpresa,
  type ManejadoresAcciones,
} from "./piezas";

export function VistaTabla({
  empresas,
  orden,
  onOrdenar,
  compacta = false,
  acciones,
}: {
  empresas: Empresa[];
  orden: Orden;
  onOrdenar: (columna: Columna) => void;
  compacta?: boolean;
  acciones: ManejadoresAcciones;
}) {
  const navegar = useNavigate();

  const th = (columna: Columna, etiqueta: string, clase = "") => (
    <th
      className={clase}
      aria-sort={
        orden.columna === columna ? (orden.sentido === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button type="button" className="th-orden" onClick={() => onOrdenar(columna)}>
        {etiqueta}
        <ChevronDown
          size={12}
          className={`th-orden__flecha ${orden.columna === columna ? `esta-activa ${orden.sentido}` : ""}`}
        />
      </button>
    </th>
  );

  return (
    <div className="marco-tabla emp-tabla">
      <table className="tabla tabla--tarjetas">
        <thead>
          <tr>
            {th("nombre", "Cliente", "emp-tabla__cliente")}
            {!compacta && <th>Módulos</th>}
            {th("estado", "Estado")}
            {th("plan", "Plan")}
            <th>Uso</th>
            {th("usuarios", "Usuarios", "num")}
            <th>Salud</th>
            {!compacta && th("renovacion", "Renovación")}
            <th className="col-acciones">
              <span className="oculto">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {empresas.map((e) => {
            const { negocio, suscripcion } = e;
            return (
              <tr
                key={negocio.id}
                className={`fila-empresa emp-fila emp-fila--${e.salud}`}
                onClick={() => navegar(`/empresas/${negocio.id}`)}
              >
                <td className="celda-principal">
                  <IdentidadEmpresa negocio={negocio} />
                </td>
                {!compacta && (
                  <td data-etiqueta="Módulos">
                    <ModulosEmpresa modulos={e.modulos} />
                  </td>
                )}
                <td data-etiqueta="Estado">
                  <EstadoEmpresa estado={negocio.estado} />
                </td>
                <td data-etiqueta="Plan" onClick={(ev) => ev.stopPropagation()}>
                  <PlanEtiqueta nombre={negocio.plan?.nombre} href={`/empresas/${negocio.id}/suscripcion`} />
                </td>
                <td className="col-uso" data-etiqueta="Uso">
                  <UsoEmpresa indicador={e.tenso} />
                </td>
                <td className="num" data-etiqueta="Usuarios">
                  <UsuariosEmpresa usados={negocio.usuarios} limite={e.usuarios.limite} />
                </td>
                <td data-etiqueta="Salud">
                  <SaludEmpresa salud={e.salud} motivo={e.alerta?.titulo} />
                </td>
                {!compacta && (
                  <td data-etiqueta="Renovación">
                    {suscripcion?.fecha_fin ? (
                      relativo(suscripcion.fecha_fin)
                    ) : (
                      <span className="tenue">sin vencimiento</span>
                    )}
                  </td>
                )}
                <td className="col-acciones" onClick={(ev) => ev.stopPropagation()}>
                  <AccionesEmpresa negocio={negocio} {...acciones} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
