/**
 * Dominios de una empresa: el administrador de sus direcciones.
 *
 * Qué hace: listar, conectar, editar (nombre y marca de verificado), elegir el
 * principal y quitar. Todo contra `/platform/tenants/{id}/dominios/`.
 *
 * Qué NO hace, porque la plataforma no lo hace: no comprueba DNS, ni
 * certificados, ni que el host responda. El indicador «verificado» es un dato
 * que se fija a mano; aquí se rotula como tal y los hosts internos (localhost,
 * IPs, nombres sin punto) nunca se presentan como públicos. Tampoco hay
 * historial de cambios todavía: se dice en el pie.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  Pencil,
  Plus,
  Server,
  Star,
  Trash2,
} from "lucide-react";
import type { DominioDetalle, Negocio, Plan, Suscripcion } from "../../api/tipos";
import { limite } from "../../datos/derivados";
import { tipoDeDominio, urlDe } from "../../datos/dominios";
import { usarPlataforma } from "../../datos/plataforma";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto, Insignia, Tarjeta } from "../../ui/basicos";
import { Menu, OpcionMenu, SeparadorMenu } from "../../ui/Menu";
import { Confirmar, Modal } from "../../ui/Modal";
import { usarAviso } from "../../ui/Notificaciones";
import "./empresa.css";

type Edicion = { modo: "nuevo" } | { modo: "editar"; dominio: DominioDetalle };

export function DominiosEmpresa({
  negocio,
  plan,
  suscripcion,
}: {
  negocio: Negocio;
  plan: Plan | null;
  suscripcion: Suscripcion | null;
}) {
  const { dominiosDe, agregarDominio, editarDominio, quitarDominio } = usarPlataforma();
  const avisar = usarAviso();
  const [lista, setLista] = useState<DominioDetalle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [quitando, setQuitando] = useState<DominioDetalle | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setLista(null);
    setError(null);
    dominiosDe(negocio.id)
      .then((d) => vigente && setLista(d))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [negocio.id, dominiosDe]);

  const cifras = useMemo(() => {
    const l = lista ?? [];
    return {
      total: l.length,
      principal: l.find((d) => d.es_primario)?.hostname ?? null,
      verificados: l.filter((d) => d.verificado).length,
      publicos: l.filter((d) => tipoDeDominio(d.hostname) === "publico").length,
      internos: l.filter((d) => tipoDeDominio(d.hostname) === "interno").length,
    };
  }, [lista]);

  const tope = limite("max_dominios", plan, suscripcion);
  const enElTope = tope !== null && cifras.total >= tope;

  async function ejecutar(accion: () => Promise<DominioDetalle[]>, exito: string) {
    setTrabajando(true);
    try {
      setLista(await accion());
      avisar(exito);
      return true;
    } catch (e) {
      avisar((e as Error).message, "malo");
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar(hostname: string) {
    try {
      await navigator.clipboard.writeText(hostname);
      avisar("Dominio copiado.");
    } catch {
      avisar("No se pudo copiar desde este navegador.", "malo");
    }
  }

  if (error) {
    return (
      <Tarjeta titulo="Dominios">
        <Aviso>{error}</Aviso>
      </Tarjeta>
    );
  }
  if (lista === null) return <Esqueleto alto={220} />;

  return (
    <>
      <dl className="dom-resumen">
        <div>
          <dt>Registrados</dt>
          <dd>
            {cifras.total}
            {tope !== null && <span className="tenue"> / {tope}</span>}
          </dd>
        </div>
        <div className="dom-resumen__principal">
          <dt>Principal</dt>
          <dd title={cifras.principal ?? undefined}>{cifras.principal ?? <span className="tenue">sin principal</span>}</dd>
        </div>
        <div>
          <dt>Públicos</dt>
          <dd>{cifras.publicos}</dd>
        </div>
        <div className={cifras.internos ? "emp-stats__aviso" : undefined}>
          <dt>Internos</dt>
          <dd>{cifras.internos}</dd>
        </div>
        <div>
          <dt>Marcados verificados</dt>
          <dd>
            {cifras.verificados}
            <span className="tenue"> / {cifras.total}</span>
          </dd>
        </div>
      </dl>

      {enElTope && (
        <Aviso tono="aviso">
          Esta empresa ya usa los {tope} dominios que permite su plan. Puedes conectar más, pero superará su límite.
        </Aviso>
      )}

      <Tarjeta
        titulo="Dominios conectados"
        accion={
          <Boton variante="primario" tamano="pequeno" icono={<Plus size={13} />} onClick={() => setEdicion({ modo: "nuevo" })}>
            Conectar dominio
          </Boton>
        }
      >
        {lista.length === 0 ? (
          <EstadoVacio icono={Globe} titulo="Sin dominios conectados">
            Esta empresa todavía no responde en ninguna dirección. Conecta el primero y quedará como principal.
          </EstadoVacio>
        ) : (
          <ul className="dom-lista">
            {lista.map((d) => {
              const interno = tipoDeDominio(d.hostname) === "interno";
              return (
                <li key={d.hostname} className={`dom-fila ${d.es_primario ? "dom-fila--principal" : ""}`}>
                  <span className={`dom-fila__icono ${interno ? "dom-fila__icono--interno" : ""}`} aria-hidden="true">
                    {interno ? <Server size={16} /> : <Globe size={16} />}
                  </span>
                  <span className="dom-fila__texto">
                    <strong title={d.hostname}>{d.hostname}</strong>
                    <span className="dom-fila__etiquetas">
                      {d.es_primario && (
                        <Insignia tono="info">
                          <Star size={10} /> Principal
                        </Insignia>
                      )}
                      {interno ? (
                        <Insignia tono="neutro">
                          <Lock size={10} /> Entorno interno
                        </Insignia>
                      ) : (
                        <Insignia tono="neutro">Público</Insignia>
                      )}
                      {!interno &&
                        (d.verificado ? (
                          <Insignia tono="ok" punto title="Indicador administrativo: la plataforma no comprueba el DNS por sí misma.">
                            Marcado como verificado
                          </Insignia>
                        ) : (
                          <Insignia tono="aviso" punto title="No se sirve tráfico a un dominio sin verificar.">
                            Sin verificar
                          </Insignia>
                        ))}
                    </span>
                  </span>
                  <span className="dom-fila__acciones">
                    {!interno && (
                      <a className="btn btn--pequeno" href={urlDe(d.hostname)} target="_blank" rel="noreferrer" aria-label={`Abrir ${d.hostname}`}>
                        <ExternalLink size={13} /> Abrir
                      </a>
                    )}
                    <Boton tamano="pequeno" icono={<Copy size={13} />} onClick={() => copiar(d.hostname)} aria-label={`Copiar ${d.hostname}`}>
                      Copiar
                    </Boton>
                    <Menu etiqueta={`Acciones de ${d.hostname}`}>
                      {(cerrar) => (
                        <>
                          <OpcionMenu
                            icono={<Pencil size={14} />}
                            onClick={() => {
                              cerrar();
                              setEdicion({ modo: "editar", dominio: d });
                            }}
                          >
                            Editar…
                          </OpcionMenu>
                          {!d.es_primario && (
                            <OpcionMenu
                              icono={<Star size={14} />}
                              disabled={trabajando}
                              onClick={() => {
                                cerrar();
                                void ejecutar(
                                  () => editarDominio(negocio.id, d.hostname, { es_primario: true }),
                                  `${d.hostname} es ahora el dominio principal.`
                                );
                              }}
                            >
                              Hacer principal
                            </OpcionMenu>
                          )}
                          <SeparadorMenu />
                          <OpcionMenu
                            icono={<Trash2 size={14} />}
                            peligrosa
                            onClick={() => {
                              cerrar();
                              setQuitando(d);
                            }}
                          >
                            Quitar…
                          </OpcionMenu>
                        </>
                      )}
                    </Menu>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Qué comprueba la plataforma">
        <ul className="dom-notas">
          <li>
            El tráfico llega a la empresa por el <code>Host</code> de la petición: cada dominio conectado y marcado como
            verificado resuelve a esta empresa.
          </li>
          <li>
            El indicador «verificado» lo fija una persona; <strong>no hay comprobación automática</strong> de DNS, de
            certificado SSL ni de conectividad.
          </li>
          <li>El principal es el que usa la tienda como dirección canónica para el SEO.</li>
          <li>El historial de cambios de dominios todavía no se registra.</li>
        </ul>
      </Tarjeta>

      {edicion && (
        <FormularioDominio
          edicion={edicion}
          trabajando={trabajando}
          onCerrar={() => setEdicion(null)}
          onGuardar={async (datos) => {
            const ok =
              edicion.modo === "nuevo"
                ? await ejecutar(() => agregarDominio(negocio.id, datos), `${datos.hostname} conectado.`)
                : await ejecutar(
                    () =>
                      editarDominio(negocio.id, edicion.dominio.hostname, {
                        hostname: datos.hostname !== edicion.dominio.hostname ? datos.hostname : undefined,
                        verificado: datos.verificado,
                      }),
                    "Dominio actualizado."
                  );
            if (ok) setEdicion(null);
          }}
        />
      )}

      {quitando && (
        <Confirmar
          titulo={`¿Quitar ${quitando.hostname}?`}
          afecta={negocio.nombre}
          etiquetaAccion="Quitar dominio"
          peligrosa
          trabajando={trabajando}
          onCerrar={() => setQuitando(null)}
          onConfirmar={async () => {
            const ok = await ejecutar(() => quitarDominio(negocio.id, quitando.hostname), `${quitando.hostname} desconectado.`);
            if (ok) setQuitando(null);
          }}
          consecuencias={
            <>
              <p>La empresa deja de responder en esa dirección de inmediato.</p>
              {quitando.es_primario && lista.length > 1 && <p>Como era el principal, otro dominio pasará a serlo.</p>}
              {lista.length === 1 && (
                <p className="dom-peligro">
                  <AlertTriangle size={14} /> Es su único dominio: la tienda quedará sin ninguna dirección.
                </p>
              )}
            </>
          }
        />
      )}
    </>
  );
}

function FormularioDominio({
  edicion,
  trabajando,
  onCerrar,
  onGuardar,
}: {
  edicion: Edicion;
  trabajando: boolean;
  onCerrar: () => void;
  onGuardar: (datos: { hostname: string; es_primario: boolean; verificado: boolean }) => Promise<void>;
}) {
  const actual = edicion.modo === "editar" ? edicion.dominio : null;
  const [hostname, setHostname] = useState(actual?.hostname ?? "");
  const [principal, setPrincipal] = useState(false);
  const [verificado, setVerificado] = useState(actual?.verificado ?? true);
  const tipo = hostname.trim() ? tipoDeDominio(hostname.trim().replace(/^https?:\/\//, "").split("/")[0]) : null;

  return (
    <Modal
      titulo={actual ? "Editar dominio" : "Conectar dominio"}
      descripcion={actual ? actual.hostname : "Una dirección por la que se llegará a esta empresa."}
      ancho={520}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            cargando={trabajando}
            disabled={!hostname.trim()}
            onClick={() => onGuardar({ hostname: hostname.trim(), es_primario: principal, verificado })}
          >
            {actual ? "Guardar cambios" : "Conectar"}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Dominio" ayuda="Solo el dominio, sin https:// ni rutas. Por ejemplo: tienda.midominio.com">
          <input autoFocus value={hostname} onChange={(e) => setHostname(e.target.value)} spellCheck={false} placeholder="tienda.midominio.com" />
        </Campo>
        {tipo === "interno" && (
          <Aviso tono="aviso">Parece una dirección interna o local: no se tratará como dominio público.</Aviso>
        )}
        <label className="dom-check">
          <input type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} />
          <span>
            Marcar como verificado
            <small className="tenue">Sin esta marca, la plataforma no sirve tráfico a este dominio. No se comprueba el DNS.</small>
          </span>
        </label>
        {!actual && (
          <label className="dom-check">
            <input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} />
            <span>
              Hacerlo el dominio principal
              <small className="tenue">El primero que se conecta ya queda como principal.</small>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
