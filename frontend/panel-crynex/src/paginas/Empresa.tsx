/**
 * El espacio de trabajo de un cliente.
 *
 * Una empresa no es una fila: es una entidad con plan, módulos, gente,
 * dominios y consumo. Al abrirla se entra a su propio espacio, con su ruta y
 * sus pestañas, y todo lo que se ve dentro es suyo y solo suyo — que es la
 * separación que sostiene la plataforma entera.
 *
 * Las pestañas son rutas y no estado local para que un aviso pueda enlazar
 * directo a la suscripción de un cliente y para que el botón de atrás funcione.
 */
import { useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Globe,
  Layers,
  PlayCircle,
  Users,
} from "lucide-react";
import type { Negocio, Plan, Suscripcion } from "../api/tipos";
import { usarPlataforma } from "../datos/plataforma";
import {
  ETIQUETA_SUSCRIPCION,
  actividadDe,
  alertasDe,
  modulosDe,
  usoDe,
} from "../datos/derivados";
import { fechaCorta, moneda, numero, relativo, tamano } from "../datos/formato";
import { Aviso, Boton, Dato, EstadoVacio, Esqueleto, Tarjeta } from "../ui/basicos";
import { Menu, OpcionMenu, SeparadorMenu } from "../ui/Menu";
import { IndicadorUso } from "../ui/Uso";
import { usarAviso } from "../ui/Notificaciones";
import { EstadoEmpresa, EstadoSuscripcionInsignia, PlanEtiqueta } from "../componentes/piezas";
import { LineaActividad } from "../componentes/LineaActividad";
import { PanelAlertas } from "../componentes/PanelAlertas";
import { DialogoEstado, DialogoPlan } from "../componentes/dialogos";

const PESTANAS = [
  { ruta: "", etiqueta: "Resumen" },
  { ruta: "suscripcion", etiqueta: "Suscripción" },
  { ruta: "modulos", etiqueta: "Módulos" },
  { ruta: "usuarios", etiqueta: "Usuarios" },
  { ruta: "dominios", etiqueta: "Dominios" },
  { ruta: "uso", etiqueta: "Uso" },
  { ruta: "actividad", etiqueta: "Actividad" },
];

export function Empresa() {
  const { id, pestana = "" } = useParams();
  const plataforma = usarPlataforma();
  const [cambiandoPlan, setCambiandoPlan] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState<Negocio["estado"] | null>(null);

  const negocio = plataforma.negocios.find((n) => String(n.id) === id) ?? null;

  if (plataforma.cargando) return <CargandoFicha />;
  if (!negocio) {
    return (
      <EstadoVacio titulo="Esa empresa no existe" accion={<Link to="/empresas">Volver a Empresas</Link>}>
        Puede que se haya archivado o que el enlace esté desactualizado.
      </EstadoVacio>
    );
  }

  const suscripcion = plataforma.suscripcionDe(negocio.id);
  const plan = plataforma.planDe(negocio);

  return (
    <>
      <Link to="/empresas" className="volver">
        <ArrowLeft size={14} /> Empresas
      </Link>

      <header className="ficha">
        <span className="ficha__inicial" aria-hidden="true">
          {negocio.nombre.slice(0, 1).toUpperCase()}
        </span>
        <div className="ficha__identidad">
          <h1>{negocio.nombre}</h1>
          <p className="ficha__meta">
            <code>{negocio.slug}</code>
            <EstadoEmpresa estado={negocio.estado} />
            <PlanEtiqueta
              nombre={negocio.plan?.nombre}
              href={`/empresas/${negocio.id}/suscripcion`}
            />
            <span className="tenue">alta {relativo(negocio.fecha_creacion)}</span>
          </p>
        </div>
        <div className="ficha__acciones">
          <Boton onClick={() => setCambiandoPlan(true)} icono={<Layers size={14} />}>
            Cambiar de plan
          </Boton>
          <Menu etiqueta="Más acciones">
            {(cerrar) => (
              <>
                {negocio.estado !== "ACTIVO" && (
                  <OpcionMenu
                    icono={<PlayCircle size={14} />}
                    onClick={() => {
                      cerrar();
                      setCambiandoEstado("ACTIVO");
                    }}
                  >
                    Marcar como activa…
                  </OpcionMenu>
                )}
                {negocio.estado !== "SUSPENDIDO" && (
                  <OpcionMenu
                    icono={<Ban size={14} />}
                    peligrosa
                    onClick={() => {
                      cerrar();
                      setCambiandoEstado("SUSPENDIDO");
                    }}
                  >
                    Suspender…
                  </OpcionMenu>
                )}
                <SeparadorMenu />
                <OpcionMenu
                  peligrosa
                  onClick={() => {
                    cerrar();
                    setCambiandoEstado("ARCHIVADO");
                  }}
                  disabled={negocio.estado === "ARCHIVADO"}
                >
                  Archivar…
                </OpcionMenu>
              </>
            )}
          </Menu>
        </div>
      </header>

      <nav className="pestanas" aria-label="Secciones de la empresa">
        {PESTANAS.map((p) => (
          <NavLink
            key={p.ruta}
            end={p.ruta === ""}
            to={`/empresas/${negocio.id}${p.ruta ? `/${p.ruta}` : ""}`}
          >
            {p.etiqueta}
          </NavLink>
        ))}
      </nav>

      <Contenido pestana={pestana} negocio={negocio} plan={plan} suscripcion={suscripcion} />

      {cambiandoPlan && (
        <DialogoPlan negocio={negocio} onCerrar={() => setCambiandoPlan(false)} />
      )}
      {cambiandoEstado && (
        <DialogoEstado
          negocio={negocio}
          estado={cambiandoEstado}
          onCerrar={() => setCambiandoEstado(null)}
        />
      )}
    </>
  );
}

interface Contexto {
  negocio: Negocio;
  plan: Plan | null;
  suscripcion: Suscripcion | null;
}

function Contenido({ pestana, ...ctx }: Contexto & { pestana: string }) {
  switch (pestana) {
    case "":
      return <VistaResumen {...ctx} />;
    case "suscripcion":
      return <VistaSuscripcion {...ctx} />;
    case "modulos":
      return <VistaModulos {...ctx} />;
    case "usuarios":
      return <VistaUsuarios {...ctx} />;
    case "dominios":
      return <VistaDominios {...ctx} />;
    case "uso":
      return <VistaUso {...ctx} />;
    case "actividad":
      return <VistaActividad {...ctx} />;
    default:
      return <Navigate to={`/empresas/${ctx.negocio.id}`} replace />;
  }
}

// ------------------------------------------------------------------ resumen

function VistaResumen({ negocio, plan, suscripcion }: Contexto) {
  const { planes, permisos, suscripciones } = usarPlataforma();
  const indicadores = usoDe(negocio, plan, suscripcion);
  const modulos = modulosDe(permisos, plan).filter((m) => m.concedidos.length > 0);
  const alertas = alertasDe([negocio], planes, suscripciones).filter(
    (a) => a.negocioId === negocio.id
  );

  return (
    <div className="grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(290px,1fr))]">
      <Tarjeta
        titulo="Suscripción"
        accion={
          <Link to={`/empresas/${negocio.id}/suscripcion`} className="enlace-accion">
            Gestionar
          </Link>
        }
      >
        {plan ? (
          <dl className="datos">
            <Dato etiqueta="Plan" destacado>
              {plan.nombre}
            </Dato>
            <Dato etiqueta="Precio" destacado>
              {Number(plan.precio_mensual) === 0
                ? "Gratis"
                : `${moneda(plan.precio_mensual, plan.moneda)} /mes`}
            </Dato>
            <Dato etiqueta="Estado">
              {suscripcion ? (
                <EstadoSuscripcionInsignia estado={suscripcion.estado} />
              ) : (
                <span className="tenue">sin suscripción</span>
              )}
            </Dato>
            <Dato etiqueta="Renovación">
              {suscripcion?.fecha_fin ? (
                <>
                  {relativo(suscripcion.fecha_fin)}{" "}
                  <span className="tenue">· {fechaCorta(suscripcion.fecha_fin)}</span>
                </>
              ) : (
                <span className="tenue">sin fecha de término</span>
              )}
            </Dato>
          </dl>
        ) : (
          <EstadoVacio titulo="Sin plan contratado">
            Sin plan no dispone de ningún módulo. Asígnale uno para que su equipo
            pueda entrar.
          </EstadoVacio>
        )}
      </Tarjeta>

      <Tarjeta titulo="Consumo">
        <div className="flex flex-col gap-3.5">
          {indicadores.map((indicador) => (
            <IndicadorUso key={indicador.clave} indicador={indicador} />
          ))}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Módulos"
        accion={
          <Link to={`/empresas/${negocio.id}/modulos`} className="enlace-accion">
            Ver todos
          </Link>
        }
      >
        {modulos.length === 0 ? (
          <EstadoVacio titulo="Ningún módulo concedido">
            Su plan no incluye permisos de ningún módulo.
          </EstadoVacio>
        ) : (
          <ul className="fichas-modulo">
            {modulos.map((modulo) => (
              <li key={modulo.nombre}>
                <span className="fichas-modulo__nombre">{modulo.nombre}</span>
                <span className="tenue">
                  {modulo.concedidos.length} de {modulo.disponibles.length} permisos
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Atención">
        <PanelAlertas alertas={alertas} cuantas={4} />
      </Tarjeta>
    </div>
  );
}

// -------------------------------------------------------------- suscripción

function VistaSuscripcion({ negocio, plan, suscripcion }: Contexto) {
  const { guardarSuscripcion } = usarPlataforma();
  const avisar = usarAviso();
  const [estado, setEstado] = useState(suscripcion?.estado ?? "PRUEBA");
  const [fechaFin, setFechaFin] = useState(suscripcion?.fecha_fin ?? "");
  const [notas, setNotas] = useState(suscripcion?.notas ?? "");
  const [guardando, setGuardando] = useState(false);

  if (!suscripcion || !plan) {
    return (
      <Tarjeta titulo="Suscripción">
        <EstadoVacio titulo="Esta empresa no tiene suscripción">
          Se crea sola en cuanto se le asigna un plan desde «Cambiar de plan».
        </EstadoVacio>
      </Tarjeta>
    );
  }

  const cambiado =
    estado !== suscripcion.estado ||
    (fechaFin || null) !== suscripcion.fecha_fin ||
    notas !== suscripcion.notas;

  async function guardar() {
    setGuardando(true);
    try {
      await guardarSuscripcion(suscripcion!.id, {
        estado,
        fecha_fin: fechaFin || null,
        notas,
      });
      avisar("Suscripción actualizada.");
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      <Tarjeta titulo="Contrato">
        <dl className="datos">
          <Dato etiqueta="Plan" destacado>
            {plan.nombre}
          </Dato>
          <Dato etiqueta="Precio" destacado>
            {Number(plan.precio_mensual) === 0
              ? "Gratis"
              : `${moneda(plan.precio_mensual, plan.moneda)} /mes`}
          </Dato>
          <Dato etiqueta="Estado">
            <EstadoSuscripcionInsignia estado={suscripcion.estado} />
          </Dato>
          <Dato etiqueta="Inicio">{fechaCorta(suscripcion.fecha_inicio)}</Dato>
          <Dato etiqueta="Término">
            {suscripcion.fecha_fin ? fechaCorta(suscripcion.fecha_fin) : "sin fecha"}
          </Dato>
          <Dato etiqueta="Empresa">{negocio.nombre}</Dato>
        </dl>
      </Tarjeta>

      <Tarjeta
        titulo="Ajustes del contrato"
        pie={
          <>
            <span className="tenue">
              El plan se cambia desde el botón de arriba: afecta a los permisos de
              toda la empresa.
            </span>
            <Boton
              variante="primario"
              onClick={guardar}
              disabled={!cambiado}
              cargando={guardando}
            >
              Guardar cambios
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="campo">
            <span className="campo__etiqueta">Estado de la suscripción</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as typeof estado)}
            >
              {(Object.keys(ETIQUETA_SUSCRIPCION) as (keyof typeof ETIQUETA_SUSCRIPCION)[]).map(
                (clave) => (
                  <option key={clave} value={clave}>
                    {ETIQUETA_SUSCRIPCION[clave]}
                  </option>
                )
              )}
            </select>
            <span className="campo__ayuda">
              Vencida o cancelada deja a la empresa sin ningún permiso, sea cual sea
              su plan.
            </span>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Fecha de término</span>
            <input
              type="date"
              value={fechaFin ?? ""}
              onChange={(e) => setFechaFin(e.target.value)}
            />
            <span className="campo__ayuda">Vacío significa sin vencimiento.</span>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Notas internas</span>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones pactadas, contacto de facturación…"
            />
          </label>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Límites pactados"
        pie={
          <span className="tenue">
            Concesiones por encima del plan, guardadas en la suscripción. Se editan
            hoy desde la administración de Django.
          </span>
        }
      >
        {Object.keys(suscripcion.limites_extra ?? {}).length === 0 ? (
          <EstadoVacio titulo="Sin excepciones">
            Esta empresa usa exactamente los límites de su plan.
          </EstadoVacio>
        ) : (
          <dl className="datos">
            {Object.entries(suscripcion.limites_extra).map(([clave, valor]) => (
              <Dato key={clave} etiqueta={clave.replace(/^max_/, "").replace(/_/g, " ")}>
                {valor === null ? "sin límite" : numero(valor)}
              </Dato>
            ))}
          </dl>
        )}
      </Tarjeta>
    </div>
  );
}

// ------------------------------------------------------------------ módulos

function VistaModulos({ plan }: Contexto) {
  const { permisos } = usarPlataforma();
  const modulos = modulosDe(permisos, plan);
  const contratados = modulos.filter((m) => m.concedidos.length > 0);

  if (contratados.length === 0) {
    return (
      <Tarjeta titulo="Módulos">
        <EstadoVacio icono={Layers} titulo="Ningún módulo activo">
          El plan de esta empresa no concede permisos de ningún módulo.
        </EstadoVacio>
      </Tarjeta>
    );
  }

  return (
    <>
      <p className="nota-seccion">
        Las soluciones de Crynex que esta empresa tiene contratadas. Lo decide su
        plan; lo que cada persona puede hacer dentro lo decide su rol, en el panel
        de la propia empresa.
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {modulos.map((modulo) => {
          const activo = modulo.concedidos.length > 0;
          return (
            <article key={modulo.nombre} className={`modulo ${activo ? "" : "esta-inactivo"}`}>
              <header>
                <h3>{modulo.nombre}</h3>
                <span className={`insignia insignia--${activo ? "ok" : "neutro"}`}>
                  <i className="insignia__punto" aria-hidden="true" />
                  {activo ? "Activo" : "No contratado"}
                </span>
              </header>
              <p className="tenue">
                {modulo.concedidos.length} de {modulo.disponibles.length} permisos
                concedidos
              </p>
              <ul className="modulo__permisos">
                {modulo.disponibles.map((permiso) => (
                  <li
                    key={permiso.codename}
                    className={
                      modulo.concedidos.includes(permiso) ? "esta-concedido" : undefined
                    }
                  >
                    {permiso.etiqueta}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}

// ----------------------------------------------------------------- usuarios

function VistaUsuarios({ negocio, plan, suscripcion }: Contexto) {
  const indicador = usoDe(negocio, plan, suscripcion)[0];
  return (
    <div className="grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      <Tarjeta titulo="Usuarios activos">
        <p className="cifra-grande">{numero(negocio.usuarios)}</p>
        <IndicadorUso indicador={indicador} />
      </Tarjeta>
      <Tarjeta titulo="Detalle del equipo">
        <EstadoVacio icono={Users} titulo="Todavía no disponible aquí">
          La API de la plataforma expone cuántas personas trabajan en esta empresa,
          pero no quiénes son: las pertenencias se administran desde el panel del
          propio cliente, que es donde tienen contexto. Esta vista se conectará
          cuando exista el endpoint.
        </EstadoVacio>
      </Tarjeta>
    </div>
  );
}

// ----------------------------------------------------------------- dominios

function VistaDominios({ negocio }: Contexto) {
  if (negocio.dominios.length === 0) {
    return (
      <Tarjeta titulo="Dominios">
        <EstadoVacio icono={Globe} titulo="Sin dominios configurados">
          Esta empresa todavía no responde en ninguna dirección.
        </EstadoVacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo="Dominios"
      pie={
        <span className="tenue">
          El estado de DNS, SSL y verificación se guarda en el modelo pero la API de
          la plataforma aún no lo expone; esta lista lo mostrará sin tocar el diseño
          en cuanto lo haga.
        </span>
      }
    >
      <ul className="dominios">
        {negocio.dominios.map((dominio, i) => (
          <li key={dominio}>
            <Globe size={15} />
            <span className="dominios__nombre">{dominio}</span>
            {i === 0 && <span className="insignia insignia--info">principal</span>}
            <a
              href={`https://${dominio}`}
              target="_blank"
              rel="noreferrer"
              className="enlace-accion"
            >
              Abrir
            </a>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------- uso

function VistaUso({ negocio, plan, suscripcion }: Contexto) {
  const indicadores = usoDe(negocio, plan, suscripcion);
  return (
    <div className="grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      <Tarjeta titulo="Consumo frente a los límites">
        <div className="flex flex-col gap-3.5">
          {indicadores.map((indicador) => (
            <IndicadorUso key={indicador.clave} indicador={indicador} />
          ))}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Límites del plan">
        {plan ? (
          <dl className="datos">
            <Dato etiqueta="Usuarios">{limiteTexto(plan.limites.max_usuarios)}</Dato>
            <Dato etiqueta="Dominios">{limiteTexto(plan.limites.max_dominios)}</Dato>
            <Dato etiqueta="Productos">{limiteTexto(plan.limites.max_productos)}</Dato>
            <Dato etiqueta="Almacenamiento">
              {plan.limites.max_almacenamiento_mb == null
                ? "sin límite"
                : tamano(plan.limites.max_almacenamiento_mb)}
            </Dato>
          </dl>
        ) : (
          <EstadoVacio titulo="Sin plan">No hay límites que mostrar.</EstadoVacio>
        )}
      </Tarjeta>
    </div>
  );
}

function limiteTexto(valor: number | null | undefined): string {
  if (valor === undefined) return "por defecto del plan";
  if (valor === null) return "sin límite";
  return numero(valor);
}

// ---------------------------------------------------------------- actividad

function VistaActividad({ negocio }: Contexto) {
  const { suscripciones } = usarPlataforma();
  const eventos = useMemo(
    () => actividadDe([negocio], suscripciones.filter((s) => s.tenant === negocio.id), 20),
    [negocio, suscripciones]
  );
  return (
    <Tarjeta
      titulo="Actividad"
      pie={
        <span className="tenue">
          Reconstruida de las fechas que guardan los registros de esta empresa. El
          histórico de cambios llegará con la auditoría.
        </span>
      }
    >
      <LineaActividad eventos={eventos} conEmpresa={false} />
    </Tarjeta>
  );
}

function CargandoFicha() {
  return (
    <>
      <Esqueleto alto={14} ancho={90} />
      <div className="ficha">
        <Esqueleto alto={44} ancho={44} radio={12} />
        <div className="ficha__identidad">
          <Esqueleto alto={22} ancho={220} />
          <Esqueleto alto={12} ancho={320} />
        </div>
      </div>
      <Aviso tono="neutro">Cargando la empresa…</Aviso>
    </>
  );
}
