/**
 * El Control Center.
 *
 * Responde en cinco segundos a «¿qué está pasando en el ecosistema?»: cuatro
 * cifras, el estado de los servicios, lo que hay que resolver, cómo crece la
 * base de clientes y quiénes son. Lo que se mira una vez al mes vive en su
 * propia pantalla.
 *
 * Todas las cifras salen de la API o de una medición. Las variaciones solo
 * aparecen cuando hay con qué compararlas: el backend guarda la fecha de alta
 * de cada empresa —así que «+N este mes» y la curva de crecimiento son datos
 * reales— pero no guarda histórico de facturación, y por eso el MRR se muestra
 * sin flecha en vez de con un porcentaje inventado.
 */
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowRight, Building2, CircleDollarSign, Plus, ShieldCheck } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import {
  ETIQUETA_ESTADO,
  TONO_ESTADO,
  actividadDe,
  alertasDe,
  crecimiento,
  metricas,
  mrrPorPlan,
  porEstado,
} from "../datos/derivados";
import { moneda, numero, porcentaje, saludo } from "../datos/formato";
import { usarSalud } from "../datos/salud";
import { usarMarca } from "../marca/ProveedorMarca";
import { Aviso, Esqueleto, EstadoVacio, Tarjeta } from "../ui/basicos";
import { BarraSegmentada, BarrasHorizontales, GraficoArea, Sparkline } from "../ui/Graficos";
import { EncabezadoPagina, TarjetaMetrica } from "../componentes/piezas";
import { TablaEmpresas } from "../componentes/TablaEmpresas";
import { CentroAcciones } from "../componentes/CentroAcciones";
import { LineaActividad } from "../componentes/LineaActividad";
import { SaludSistema } from "../componentes/SaludSistema";

export function Resumen() {
  const { negocios, planes, suscripciones, usuario, cargando, error } = usarPlataforma();
  const { disponibilidad, servicios } = usarSalud();
  const { activa } = usarMarca();
  const { hash } = useLocation();

  const cifras = useMemo(() => metricas(negocios, planes, suscripciones), [negocios, planes, suscripciones]);
  const alertas = useMemo(() => alertasDe(negocios, planes, suscripciones), [negocios, planes, suscripciones]);
  const actividad = useMemo(() => actividadDe(negocios, suscripciones, 6), [negocios, suscripciones]);
  const serie = useMemo(() => crecimiento(negocios, 6), [negocios]);
  const ingresos = useMemo(() => mrrPorPlan(planes, suscripciones), [planes, suscripciones]);
  const estados = useMemo(() => porEstado(negocios), [negocios]);

  // La campana de la cabecera enlaza a `/#acciones`.
  useEffect(() => {
    if (hash !== "#acciones" || cargando) return;
    document.getElementById("acciones")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, cargando]);

  const medidos = servicios.filter((s) => s.estado !== "comprobando");
  const caidos = medidos.filter((s) => s.estado === "caido").length;
  const criticas = alertas.filter((a) => a.nivel === "critico").length;

  return (
    <>
      <EncabezadoPagina
        antetitulo={`${activa.nombre} · ${saludo(usuario?.nombre_usuario)}`}
        titulo="Control Center"
        descripcion="Resumen de lo que está ocurriendo en tu ecosistema."
        acciones={
          <Link to="/empresas?nueva=1" className="btn btn--primario">
            <Plus size={14} /> Nueva empresa
          </Link>
        }
      />

      {error && <Aviso>{error}</Aviso>}

      <div className="kpis">
        {cargando ? (
          Array.from({ length: 4 }, (_, i) => (
            <article key={i} className="metrica">
              <Esqueleto alto={11} ancho="45%" />
              <Esqueleto alto={30} ancho="55%" />
              <Esqueleto alto={11} ancho="70%" />
            </article>
          ))
        ) : (
          <>
            <TarjetaMetrica
              etiqueta="Empresas"
              icono={<Building2 size={15} />}
              valor={String(cifras.empresas).padStart(2, "0")}
              destino="/empresas"
              grafico={serie.some((p) => p.valor > 0) ? <Sparkline valores={serie.map((p) => p.valor)} /> : undefined}
              variacion={
                cifras.altasEsteMes > 0 ? { texto: `+${cifras.altasEsteMes}`, sentido: "sube" } : undefined
              }
              contexto={cifras.altasEsteMes > 0 ? "este mes" : "sin altas este mes"}
            />
            <TarjetaMetrica
              etiqueta="Activas"
              icono={<Activity size={15} />}
              valor={String(cifras.activas).padStart(2, "0")}
              destino="/empresas"
              contexto={`${porcentaje(cifras.activas, cifras.empresas)} del total · ${numero(cifras.operativas)} operativas`}
            />
            <TarjetaMetrica
              etiqueta="MRR"
              icono={<CircleDollarSign size={15} />}
              valor={moneda(cifras.mrr, cifras.moneda)}
              destino="/suscripciones"
              contexto={`${numero(cifras.facturando)} ${
                cifras.facturando === 1 ? "suscripción activa" : "suscripciones activas"
              } · ARPU ${moneda(cifras.arpu, cifras.moneda)}`}
            />
            <TarjetaMetrica
              etiqueta="System Health"
              icono={<ShieldCheck size={15} />}
              valor={disponibilidad === null ? "—" : `${(disponibilidad * 100).toFixed(disponibilidad === 1 ? 0 : 1)}%`}
              tono={disponibilidad === null || disponibilidad === 1 ? undefined : caidos ? "malo" : "aviso"}
              contexto={
                disponibilidad === null
                  ? "Comprobando servicios…"
                  : disponibilidad === 1
                    ? `Operativo · ${medidos.length} servicios`
                    : `${medidos.length - medidos.filter((s) => s.estado === "operativo").length} con incidencias`
              }
            />
          </>
        )}
      </div>

      <div className="rejilla-dashboard">
        <Tarjeta
          titulo="Crecimiento"
          className="rejilla-dashboard__crecimiento"
          accion={<span className="tenue">Empresas acumuladas · 6 meses</span>}
        >
          {cargando ? (
            <Esqueleto alto={150} />
          ) : (
            <div className="analitica">
              <div className="analitica__cifra">
                <strong>{numero(cifras.empresas)}</strong>
                <span className="tenue">
                  {cifras.altasEsteMes > 0
                    ? `+${cifras.altasEsteMes} este mes`
                    : "sin altas nuevas este mes"}
                </span>
              </div>
              <GraficoArea puntos={serie} etiqueta="Empresas acumuladas por mes" />
            </div>
          )}
        </Tarjeta>

        <SaludSistema />

        <Tarjeta titulo="Ingresos por plan" accion={<span className="tenue">MRR</span>}>
          {cargando ? (
            <Esqueleto alto={110} />
          ) : ingresos.length === 0 ? (
            <EstadoVacio titulo="Sin ingresos recurrentes">
              Ninguna suscripción activa tiene un plan con precio.
            </EstadoVacio>
          ) : (
            <BarrasHorizontales
              filas={ingresos.map((f) => ({
                etiqueta: f.plan,
                valor: f.mrr,
                detalle: `${f.suscripciones} ${f.suscripciones === 1 ? "suscripción" : "suscripciones"}`,
              }))}
              formato={(n) => moneda(n, cifras.moneda)}
            />
          )}
        </Tarjeta>

        <Tarjeta titulo="Estado de la base" accion={<span className="tenue">{numero(cifras.empresas)} empresas</span>}>
          {cargando ? (
            <Esqueleto alto={60} />
          ) : (
            <BarraSegmentada
              partes={estados.map((e) => ({
                etiqueta: ETIQUETA_ESTADO[e.estado],
                valor: e.cuantas,
                tono: TONO_ESTADO[e.estado],
              }))}
            />
          )}
        </Tarjeta>
      </div>

      <div className="rejilla-operacion">
        <Tarjeta
          id="acciones"
          titulo={
            <h2 className="titulo-con-cuenta">
              Action Center
              {alertas.length > 0 && (
                <span className={`cuenta-chip ${criticas ? "cuenta-chip--malo" : "cuenta-chip--aviso"}`}>
                  {alertas.length}
                </span>
              )}
            </h2>
          }
          accion={
            alertas.length > 5 && (
              <Link to="/empresas?filtro=atencion" className="enlace-accion">
                Ver las {alertas.length} <ArrowRight size={13} />
              </Link>
            )
          }
        >
          {cargando ? <Esqueleto alto={120} /> : <CentroAcciones alertas={alertas} />}
        </Tarjeta>

        <Tarjeta
          titulo="Actividad reciente"
          accion={
            <Link to="/actividad" className="enlace-accion">
              Ver todo <ArrowRight size={13} />
            </Link>
          }
        >
          <LineaActividad eventos={actividad} />
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Empresas"
        accion={
          <Link to="/empresas" className="enlace-accion">
            Ver todas <ArrowRight size={13} />
          </Link>
        }
        className="tarjeta--tabla"
      >
        <TablaEmpresas negocios={negocios} cargando={cargando} compacta />
      </Tarjeta>
    </>
  );
}
