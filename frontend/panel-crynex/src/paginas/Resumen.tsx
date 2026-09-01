/**
 * El Control Center.
 *
 * Responde en cinco segundos a "¿qué está pasando en Crynex?": cuántos clientes
 * hay, cuántos están activos, cuánto se factura y qué necesita atención hoy.
 * Cuatro cifras y tres bloques; nada más entra aquí. Lo que se mira una vez al
 * mes vive en su propia pantalla.
 *
 * Las variaciones solo aparecen cuando hay con qué compararlas. Hoy el backend
 * guarda la fecha de alta de cada empresa —así que "+N este mes" es un dato
 * real— pero no guarda histórico de facturación, y por eso el MRR se muestra
 * sin flecha en vez de con un porcentaje inventado.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { actividadDe, alertasDe, metricas } from "../datos/derivados";
import { moneda, numero, porcentaje, saludo } from "../datos/formato";
import { Aviso, Esqueleto, Tarjeta } from "../ui/basicos";
import { TarjetaMetrica } from "../componentes/piezas";
import { TablaEmpresas } from "../componentes/TablaEmpresas";
import { PanelAlertas } from "../componentes/PanelAlertas";
import { LineaActividad } from "../componentes/LineaActividad";

export function Resumen() {
  const { negocios, planes, suscripciones, usuario, cargando, error } =
    usarPlataforma();

  const cifras = useMemo(
    () => metricas(negocios, planes, suscripciones),
    [negocios, planes, suscripciones]
  );
  const alertas = useMemo(
    () => alertasDe(negocios, planes, suscripciones),
    [negocios, planes, suscripciones]
  );
  const actividad = useMemo(
    () => actividadDe(negocios, suscripciones, 6),
    [negocios, suscripciones]
  );

  return (
    <>
      <header className="titulo-pagina">
        <h1>Control Center</h1>
        <p className="tenue">
          {saludo(usuario?.nombre_usuario)} Esto es lo que pasa en tu ecosistema.
        </p>
      </header>

      {error && <Aviso>{error}</Aviso>}

      <div className="mb-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {cargando ? (
          Array.from({ length: 4 }, (_, i) => (
            <article key={i} className="metrica">
              <Esqueleto alto={11} ancho="45%" />
              <Esqueleto alto={26} ancho="60%" />
              <Esqueleto alto={11} ancho="70%" />
            </article>
          ))
        ) : (
          <>
            <TarjetaMetrica
              etiqueta="Empresas"
              valor={numero(cifras.empresas)}
              destino="/empresas"
              variacion={
                cifras.altasEsteMes > 0
                  ? { texto: `+${cifras.altasEsteMes}`, sentido: "sube" }
                  : undefined
              }
              contexto={cifras.altasEsteMes > 0 ? "este mes" : "sin altas este mes"}
            />
            <TarjetaMetrica
              etiqueta="Activas"
              valor={numero(cifras.activas)}
              destino="/empresas"
              contexto={`${porcentaje(cifras.activas, cifras.empresas)} del total · ${numero(
                cifras.operativas
              )} operativas`}
            />
            <TarjetaMetrica
              etiqueta="MRR"
              valor={moneda(cifras.mrr, cifras.moneda)}
              contexto={`${numero(cifras.facturando)} ${
                cifras.facturando === 1 ? "suscripción activa" : "suscripciones activas"
              } · ARPU ${moneda(cifras.arpu, cifras.moneda)}`}
            />
            <TarjetaMetrica
              etiqueta="Requieren atención"
              valor={numero(alertas.length)}
              destino="/empresas?filtro=atencion"
              tono={
                alertas.some((a) => a.nivel === "critico")
                  ? "malo"
                  : alertas.length
                    ? "aviso"
                    : undefined
              }
              contexto={
                alertas.length === 0
                  ? "todo en orden"
                  : `${alertas.filter((a) => a.nivel === "critico").length} críticas`
              }
            />
          </>
        )}
      </div>

      <div className="grid items-start gap-3 grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
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

        <div className="flex flex-col gap-3">
          <Tarjeta
            titulo="Atención requerida"
            accion={
              alertas.length > 5 && (
                <Link to="/empresas?filtro=atencion" className="enlace-accion">
                  {alertas.length} en total <ArrowRight size={13} />
                </Link>
              )
            }
          >
            <PanelAlertas alertas={alertas} />
          </Tarjeta>

          <Tarjeta
            titulo="Actividad reciente"
            pie={
              <span className="tenue">
                Reconstruida de las fechas que guardan los propios registros. El
                histórico completo llegará con la auditoría.
              </span>
            }
          >
            <LineaActividad eventos={actividad} />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
