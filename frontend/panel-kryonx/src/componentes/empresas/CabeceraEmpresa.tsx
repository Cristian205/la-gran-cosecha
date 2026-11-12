/**
 * La cabecera ejecutiva de una empresa y su navegación.
 *
 * Una franja compacta con quién es (logo, nombre, identificador, estado, plan,
 * alta), las dos acciones que más se usan (cambiar de plan y el menú) y, debajo,
 * cinco indicadores que salen de datos reales: productos, usuarios, dominios,
 * consumo y renovación. Lo que la plataforma aún no mide no se muestra.
 *
 * La navegación agrupa las nueve secciones por lo que responden —quién es,
 * qué contrató, cómo opera, qué ha pasado— sin quitar ninguna.
 */
import { useMemo } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Ban,
  Boxes,
  CreditCard,
  Gauge,
  Globe,
  IdCard,
  Layers,
  LayoutDashboard,
  Package,
  PlayCircle,
  Users,
} from "lucide-react";
import type { EstadoNegocio, Negocio, Plan, Suscripcion } from "../../api/tipos";
import { nivelDe, razonDe, usoDe } from "../../datos/derivados";
import { fechaCorta, numero, relativo } from "../../datos/formato";
import { productoEnEmpresa } from "../../datos/productos";
import { usarPlataforma } from "../../datos/plataforma";
import { Boton } from "../../ui/basicos";
import { Menu, OpcionMenu, SeparadorMenu } from "../../ui/Menu";
import { EstadoEmpresa, PlanEtiqueta } from "../piezas";
import { AvatarEmpresa } from "./piezas";
import "./empresa.css";

const GRUPOS = [
  {
    nombre: "General",
    secciones: [
      { ruta: "", etiqueta: "Resumen", icono: LayoutDashboard },
      { ruta: "identidad", etiqueta: "Identidad", icono: IdCard },
    ],
  },
  {
    nombre: "Comercial",
    secciones: [
      { ruta: "suscripcion", etiqueta: "Suscripción", icono: CreditCard },
      { ruta: "productos", etiqueta: "Productos", icono: Package },
      { ruta: "modulos", etiqueta: "Módulos", icono: Boxes },
    ],
  },
  {
    nombre: "Operación",
    secciones: [
      { ruta: "usuarios", etiqueta: "Usuarios", icono: Users },
      { ruta: "dominios", etiqueta: "Dominios", icono: Globe },
      { ruta: "uso", etiqueta: "Uso", icono: Gauge },
    ],
  },
  {
    nombre: "Registro",
    secciones: [{ ruta: "actividad", etiqueta: "Actividad", icono: Activity }],
  },
];

export function CabeceraEmpresa({
  negocio,
  plan,
  suscripcion,
  onCambiarPlan,
  onEstado,
}: {
  negocio: Negocio;
  plan: Plan | null;
  suscripcion: Suscripcion | null;
  onCambiarPlan: () => void;
  onEstado: (estado: EstadoNegocio) => void;
}) {
  const navegar = useNavigate();
  const { productos, permisos } = usarPlataforma();

  const indicadores = useMemo(() => usoDe(negocio, plan, suscripcion), [negocio, plan, suscripcion]);
  const usuarios = indicadores.find((i) => i.clave === "max_usuarios");
  const dominios = indicadores.find((i) => i.clave === "max_dominios");
  // El consumo que más aprieta, entre los que sí se miden.
  const tenso = [...indicadores]
    .filter((i) => razonDe(i) !== null)
    .sort((a, b) => (razonDe(b) ?? 0) - (razonDe(a) ?? 0))[0];
  const contratados = useMemo(
    () => productos.filter((p) => productoEnEmpresa(p, permisos, negocio, plan, suscripcion).concedidos > 0).length,
    [productos, permisos, negocio, plan, suscripcion]
  );

  const limiteDe = (i?: { limite: number | null }) => (i && i.limite !== null ? ` / ${numero(i.limite)}` : "");

  return (
    <>
      <header className="ce-cabecera">
        <div className="ce-cabecera__principal">
          <Link to="/empresas" className="ce-volver" aria-label="Volver a Empresas" title="Volver a Empresas">
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <AvatarEmpresa negocio={negocio} tamano="xl" className="ficha__avatar" />
          <div className="ce-cabecera__identidad">
            <h1>{negocio.nombre}</h1>
            <p className="ce-cabecera__meta">
              <code>{negocio.slug}</code>
              <EstadoEmpresa estado={negocio.estado} />
              <PlanEtiqueta nombre={negocio.plan?.nombre} href={`/empresas/${negocio.id}/suscripcion`} />
              <span className="tenue" title={negocio.fecha_creacion.slice(0, 10)}>
                Alta {relativo(negocio.fecha_creacion)}
              </span>
            </p>
          </div>
          <div className="ce-cabecera__acciones">
            <Boton onClick={onCambiarPlan} icono={<Layers size={14} />}>
              Cambiar de plan
            </Boton>
            <Menu etiqueta="Más acciones">
              {(cerrar) => (
                <>
                  <OpcionMenu
                    icono={<IdCard size={14} />}
                    onClick={() => {
                      cerrar();
                      navegar(`/empresas/${negocio.id}/identidad`);
                    }}
                  >
                    Editar identidad corporativa
                  </OpcionMenu>
                  <SeparadorMenu />
                  {negocio.estado !== "ACTIVO" && (
                    <OpcionMenu
                      icono={<PlayCircle size={14} />}
                      onClick={() => {
                        cerrar();
                        onEstado("ACTIVO");
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
                        onEstado("SUSPENDIDO");
                      }}
                    >
                      Suspender…
                    </OpcionMenu>
                  )}
                  <SeparadorMenu />
                  <OpcionMenu
                    peligrosa
                    disabled={negocio.estado === "ARCHIVADO"}
                    onClick={() => {
                      cerrar();
                      onEstado("ARCHIVADO");
                    }}
                  >
                    Archivar…
                  </OpcionMenu>
                </>
              )}
            </Menu>
          </div>
        </div>

        <dl className="ce-indicadores">
          <Link to={`/empresas/${negocio.id}/productos`} className="ce-indicador">
            <dt>Productos</dt>
            <dd>{numero(contratados)}</dd>
          </Link>
          <Link to={`/empresas/${negocio.id}/usuarios`} className="ce-indicador">
            <dt>Usuarios</dt>
            <dd>
              {numero(negocio.usuarios)}
              <span className="tenue">{limiteDe(usuarios)}</span>
            </dd>
          </Link>
          <Link to={`/empresas/${negocio.id}/dominios`} className="ce-indicador">
            <dt>Dominios</dt>
            <dd>
              {numero(negocio.dominios.length)}
              <span className="tenue">{limiteDe(dominios)}</span>
            </dd>
          </Link>
          <Link to={`/empresas/${negocio.id}/uso`} className={`ce-indicador ${tenso ? `ce-indicador--${nivelDe(tenso)}` : ""}`}>
            <dt>Consumo</dt>
            <dd>{tenso ? `${Math.round((razonDe(tenso) ?? 0) * 100)}%` : <span className="tenue">sin medición</span>}</dd>
            {tenso && <small className="tenue">{tenso.etiqueta}</small>}
          </Link>
          <Link to={`/empresas/${negocio.id}/suscripcion`} className="ce-indicador">
            <dt>Renovación</dt>
            <dd>
              {suscripcion?.fecha_fin ? relativo(suscripcion.fecha_fin) : <span className="tenue">sin fecha</span>}
            </dd>
            {suscripcion?.fecha_fin && <small className="tenue">{fechaCorta(suscripcion.fecha_fin)}</small>}
          </Link>
        </dl>
      </header>

      <nav className="ce-nav" aria-label="Secciones de la empresa">
        {GRUPOS.map((g) => (
          <div key={g.nombre} className="ce-nav__grupo" role="group" aria-label={g.nombre}>
            <span className="ce-nav__titulo">{g.nombre}</span>
            <div className="ce-nav__items">
              {g.secciones.map(({ ruta, etiqueta, icono: Icono }) => (
                <NavLink key={ruta} end={ruta === ""} to={`/empresas/${negocio.id}${ruta ? `/${ruta}` : ""}`}>
                  <Icono size={15} aria-hidden="true" />
                  {etiqueta}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
