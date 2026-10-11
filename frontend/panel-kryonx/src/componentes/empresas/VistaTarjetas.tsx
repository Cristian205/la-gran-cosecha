/**
 * La vista de exploración: cada empresa como un WORKSPACE.
 *
 * No es una fila partida en cajas. La tarjeta se lee de arriba abajo como un
 * entorno: quién es (identidad, plan y salud), cuánto ocupa (módulos,
 * usuarios, uso), en qué estado está, y la puerta para entrar. Si algo va
 * mal, la tarjeta lo dice con el indicador y ofrece resolverlo; el fondo no
 * se pinta de rojo.
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { relativo } from "../../datos/formato";
import { EstadoEmpresa, PlanEtiqueta } from "../piezas";
import { destinoDeAlerta, type Empresa } from "./modelo";
import {
  AccionesEmpresa,
  BotonWorkspace,
  IdentidadEmpresa,
  ModulosEmpresa,
  SaludEmpresa,
  UsoEmpresa,
  UsuariosEmpresa,
  type ManejadoresAcciones,
} from "./piezas";

export function VistaTarjetas({
  empresas,
  acciones,
}: {
  empresas: Empresa[];
  acciones: ManejadoresAcciones;
}) {
  return (
    <ul className="emp-tarjetas" aria-label="Empresas">
      {empresas.map((e) => (
        <li key={e.negocio.id}>
          <TarjetaEmpresa empresa={e} acciones={acciones} />
        </li>
      ))}
    </ul>
  );
}

function TarjetaEmpresa({ empresa: e, acciones }: { empresa: Empresa; acciones: ManejadoresAcciones }) {
  const { negocio, suscripcion } = e;
  const destinoResolver = e.alerta && e.salud === "malo" ? destinoDeAlerta(e.alerta) : null;
  const suspendida = e.salud === "malo" && e.alerta?.tipo === "suspendida";

  return (
    <article className={`emp-tarjeta emp-tarjeta--${e.salud}`} aria-label={negocio.nombre}>
      <header className="emp-tarjeta__cabecera">
        <IdentidadEmpresa negocio={negocio} grande />
        <AccionesEmpresa negocio={negocio} {...acciones} />
      </header>

      <div className="emp-tarjeta__etiquetas">
        <PlanEtiqueta nombre={negocio.plan?.nombre} href={`/empresas/${negocio.id}/suscripcion`} />
        <SaludEmpresa salud={e.salud} />
      </div>

      <dl className="emp-tarjeta__datos">
        <div>
          <dt>Módulos</dt>
          <dd>
            <ModulosEmpresa modulos={e.modulos} />
          </dd>
        </div>
        <div>
          <dt>Usuarios</dt>
          <dd>
            <UsuariosEmpresa usados={negocio.usuarios} limite={e.usuarios.limite} />
          </dd>
        </div>
        <div className="emp-tarjeta__uso">
          <dt>Uso{e.tenso.limite !== null && <span> · {e.tenso.etiqueta.toLowerCase()}</span>}</dt>
          <dd>
            <UsoEmpresa indicador={e.tenso} ancho />
          </dd>
        </div>
      </dl>

      {/* El problema, si lo hay, en su propia franja: texto y acción, sin teñir la tarjeta. */}
      {e.salud !== "ok" && e.alerta && (
        <div className={`emp-tarjeta__aviso emp-tarjeta__aviso--${e.salud}`} role="status">
          <span>
            <strong>{e.alerta.titulo}</strong>
            <span className="emp-tarjeta__aviso-detalle">{e.alerta.detalle}</span>
          </span>
          {destinoResolver ? (
            <Link to={destinoResolver} className="emp-tarjeta__resolver">
              Resolver <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ) : (
            suspendida && (
              <button
                type="button"
                className="emp-tarjeta__resolver"
                onClick={() => acciones.onCambiarEstado(negocio, "ACTIVO")}
              >
                Reactivar <ArrowRight size={13} aria-hidden="true" />
              </button>
            )
          )}
        </div>
      )}

      <footer className="emp-tarjeta__pie">
        <span className="emp-tarjeta__estado">
          <EstadoEmpresa estado={negocio.estado} />
          <span className="tenue" title={`Alta: ${negocio.fecha_creacion.slice(0, 10)}`}>
            Alta {relativo(negocio.fecha_creacion)}
            {suscripcion?.fecha_fin ? ` · renueva ${relativo(suscripcion.fecha_fin)}` : ""}
          </span>
        </span>
        <BotonWorkspace negocio={negocio} />
      </footer>
    </article>
  );
}
