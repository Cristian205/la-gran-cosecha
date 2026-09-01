/**
 * Los planes de Crynex, uno al lado del otro.
 *
 * La pregunta que se hace aquí es comparativa —"¿qué diferencia hay entre
 * Starter y Business?"— y por eso los planes se dibujan en columnas con las
 * mismas filas, no en fichas sueltas: el ojo compara verticalmente sin tener
 * que recordar lo que decía la tarjeta anterior.
 *
 * Qué permisos concede cada plan se edita en la matriz, no aquí. Son dos
 * preguntas distintas y mezclarlas convertiría esta pantalla en un formulario.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Star, Power } from "lucide-react";
import type { Plan } from "../api/tipos";
import { usarPlataforma } from "../datos/plataforma";
import { modulosDe } from "../datos/derivados";
import { moneda, numero, tamano } from "../datos/formato";
import { Aviso, Boton, EstadoVacio, Esqueleto, Insignia } from "../ui/basicos";
import { Confirmar } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

function limiteTexto(plan: Plan, clave: string): string {
  const valor = plan.limites?.[clave];
  if (valor === undefined) return "por defecto";
  if (valor === null) return "Sin límite";
  return clave === "max_almacenamiento_mb" ? tamano(valor) : numero(valor);
}

export function Planes() {
  const { planes, permisos, cargando, error, guardarPlan, archivarPlan, marcarPredeterminado } =
    usarPlataforma();
  const avisar = usarAviso();
  const [retirando, setRetirando] = useState<Plan | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  if (cargando) {
    return (
      <div className="grid items-stretch gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="plan">
            <Esqueleto alto={16} ancho="50%" />
            <Esqueleto alto={30} ancho="70%" />
            <Esqueleto alto={90} />
          </div>
        ))}
      </div>
    );
  }

  /** Envuelve cualquier accion sobre un plan con su aviso y su error. */
  async function actuar(accion: () => Promise<unknown>, mensaje: string) {
    setTrabajando(true);
    try {
      await accion();
      avisar(mensaje);
      setRetirando(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Planes</h1>
          <p className="tenue">
            Lo que una empresa contrata: qué límites tiene y cuánto paga. Los
            permisos que concede cada plan se administran en{" "}
            <Link to="/permisos">la matriz</Link>.
          </p>
        </div>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {planes.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay planes">
          Sin planes, ninguna empresa puede tener permisos. Se crean desde la
          administración de Django.
        </EstadoVacio>
      ) : (
        <div className="grid items-stretch gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          {planes.map((plan) => {
            const modulos = modulosDe(permisos, plan).filter(
              (m) => m.concedidos.length > 0
            );
            return (
              <article
                key={plan.id}
                className={`plan ${plan.activo ? "" : "esta-retirado"} ${
                  plan.es_predeterminado ? "es-predeterminado" : ""
                }`}
              >
                <header className="plan__cabecera">
                  <h2>{plan.nombre}</h2>
                  <div className="plan__marcas">
                    {plan.es_predeterminado && (
                      <Insignia tono="info">
                        <Star size={11} /> Por defecto
                      </Insignia>
                    )}
                    {!plan.activo && <Insignia tono="neutro">Retirado</Insignia>}
                  </div>
                </header>

                <p className="plan__precio">
                  {Number(plan.precio_mensual) === 0 ? (
                    "Gratis"
                  ) : (
                    <>
                      {moneda(plan.precio_mensual, plan.moneda)}
                      <span className="tenue"> /mes</span>
                    </>
                  )}
                </p>
                {plan.descripcion && <p className="tenue">{plan.descripcion}</p>}

                <dl className="plan__limites">
                  <div>
                    <dt>Usuarios</dt>
                    <dd>{limiteTexto(plan, "max_usuarios")}</dd>
                  </div>
                  <div>
                    <dt>Dominios</dt>
                    <dd>{limiteTexto(plan, "max_dominios")}</dd>
                  </div>
                  <div>
                    <dt>Productos</dt>
                    <dd>{limiteTexto(plan, "max_productos")}</dd>
                  </div>
                  <div>
                    <dt>Almacenamiento</dt>
                    <dd>{limiteTexto(plan, "max_almacenamiento_mb")}</dd>
                  </div>
                </dl>

                <div className="plan__modulos">
                  <p className="plan__subtitulo">
                    {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"} ·{" "}
                    {plan.permisos.length} permisos
                  </p>
                  <ul>
                    {modulos.map((modulo) => (
                      <li key={modulo.nombre}>
                        <Check size={13} /> {modulo.nombre}
                      </li>
                    ))}
                  </ul>
                </div>

                <footer className="plan__pie">
                  <span className="tenue">
                    {plan.negocios} {plan.negocios === 1 ? "empresa" : "empresas"}
                  </span>
                  <div className="plan__botones">
                    {!plan.es_predeterminado && plan.activo && (
                      <Boton
                        tamano="pequeno"
                        onClick={() =>
                          actuar(
                            () => marcarPredeterminado(plan),
                            `Las empresas nuevas entrarán en ${plan.nombre}.`
                          )
                        }
                      >
                        Hacer predeterminado
                      </Boton>
                    )}
                    {plan.activo ? (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        icono={<Power size={13} />}
                        onClick={() => setRetirando(plan)}
                      >
                        Retirar
                      </Boton>
                    ) : (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        icono={<Power size={13} />}
                        onClick={() =>
                          actuar(
                            () => guardarPlan(plan.id, { estado: "ACTIVO" }),
                            `${plan.nombre} vuelve a estar disponible.`
                          )
                        }
                      >
                        Reactivar
                      </Boton>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {retirando && (
        <Confirmar
          titulo={`Retirar ${retirando.nombre}`}
          afecta={
            retirando.negocios > 0
              ? `${retirando.negocios} ${
                  retirando.negocios === 1 ? "empresa que lo tiene" : "empresas que lo tienen"
                }`
              : "ninguna empresa"
          }
          etiquetaAccion="Retirar el plan"
          peligrosa
          trabajando={trabajando}
          onCerrar={() => setRetirando(null)}
          onConfirmar={() =>
            actuar(
              () => archivarPlan(retirando),
              `${retirando.nombre} queda archivado.`
            )
          }
          consecuencias={
            <>
              <p>
                Deja de poder contratarse. Las empresas que ya lo tienen lo conservan
                intacto: nadie pierde permisos por retirar un plan.
              </p>
              <p className="tenue">Se puede reactivar en cualquier momento.</p>
            </>
          }
        />
      )}
    </>
  );
}
