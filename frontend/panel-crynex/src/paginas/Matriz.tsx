/**
 * La matriz: qué concede cada plan.
 *
 * Es la pantalla que decide qué puede hacer cada cliente y se dibuja como
 * tabla —permisos en filas, planes en columnas— porque la pregunta que responde
 * es comparativa: no "¿qué tiene Growth?" sino "¿qué diferencia hay entre
 * Starter y Growth?". Una lista por plan obligaría a recordar la anterior.
 *
 * Las celdas se guardan al pulsarlas, sin botón de guardar. Es un panel interno
 * de poca gente y el cambio es de un solo dato; un formulario con confirmación
 * solo añadiría un paso donde no hay ambigüedad. Retirar un permiso de Crynex
 * entero sí se confirma: eso lo apaga en todas las empresas a la vez.
 */
import { Fragment, useMemo, useState } from "react";
import { Check, Minus, Pencil, Plus, Power, Search } from "lucide-react";
import type { Permiso } from "../api/tipos";
import { usarPlataforma } from "../datos/plataforma";
import { moneda } from "../datos/formato";
import { Aviso, Boton, Campo, EstadoVacio, Esqueleto } from "../ui/basicos";
import { Confirmar, Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

export function Matriz() {
  const { permisos, planes, productos, cargando, error, guardarPlan, crearPermiso, guardarPermiso } =
    usarPlataforma();
  const avisar = usarAviso();
  const [texto, setTexto] = useState("");
  const [guardandoCelda, setGuardandoCelda] = useState<string | null>(null);
  const [retirando, setRetirando] = useState<Permiso | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Permiso | null>(null);

  /** Los permisos agrupados por módulo, que es como se leen. */
  const porModulo = useMemo(() => {
    const busqueda = texto.trim().toLowerCase();
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of permisos) {
      if (
        busqueda &&
        !`${permiso.etiqueta} ${permiso.codename} ${permiso.modulo}`
          .toLowerCase()
          .includes(busqueda)
      )
        continue;
      if (!grupos.has(permiso.modulo)) grupos.set(permiso.modulo, []);
      grupos.get(permiso.modulo)!.push(permiso);
    }
    return [...grupos.entries()];
  }, [permisos, texto]);

  async function alternarCelda(planId: number, codename: string) {
    const plan = planes.find((p) => p.id === planId);
    if (!plan) return;
    const clave = `${planId}:${codename}`;
    const incluido = plan.permisos.includes(codename);
    const siguiente = incluido
      ? plan.permisos.filter((c) => c !== codename)
      : [...plan.permisos, codename];

    setGuardandoCelda(clave);
    try {
      await guardarPlan(plan.id, { permisos: siguiente });
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setGuardandoCelda(null);
    }
  }

  async function retirar(permiso: Permiso, activo: boolean) {
    setTrabajando(true);
    try {
      await guardarPermiso(permiso.id, { activo });
      avisar(
        activo
          ? `${permiso.etiqueta} vuelve a estar disponible.`
          : `${permiso.etiqueta} queda retirado de toda la plataforma.`
      );
      setRetirando(null);
    } catch (e) {
      avisar((e as Error).message, "malo");
    } finally {
      setTrabajando(false);
    }
  }

  if (cargando) {
    return (
      <div className="marco-tabla">
        <div className="esqueleto-tabla">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="esqueleto-tabla__fila">
              <Esqueleto alto={12} ancho="30%" />
              <Esqueleto alto={22} ancho={26} radio={7} />
              <Esqueleto alto={22} ancho={26} radio={7} />
              <Esqueleto alto={22} ancho={26} radio={7} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="titulo-pagina titulo-pagina--con-resumen">
        <div>
          <h1>Permisos</h1>
          <p className="tenue">
            Qué concede cada plan. El plan marca el techo de una empresa; quién
            hace qué dentro de ella lo reparte su propio panel. Un permiso
            retirado desaparece de todos los negocios, sea cual sea su plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="filtros__buscar filtros__buscar--suelto">
            <Search size={15} />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Filtrar permisos…"
              aria-label="Filtrar permisos"
            />
          </div>
          <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setCreando(true)}>
            Nuevo permiso
          </Boton>
        </div>
      </header>

      {error && <Aviso>{error}</Aviso>}

      {porModulo.length === 0 ? (
        <EstadoVacio titulo="Ningún permiso coincide" accion={<Boton onClick={() => setTexto("")}>Quitar el filtro</Boton>}>
          Prueba con otro término o con el nombre de un módulo.
        </EstadoVacio>
      ) : (
        <div className="marco-tabla">
          <table className="tabla matriz">
            <thead>
              <tr>
                <th className="col-permiso">Permiso</th>
                {planes.map((plan) => (
                  <th key={plan.id} className="col-plan">
                    <span className="col-plan__nombre">{plan.nombre}</span>
                    <span className="col-plan__meta">
                      {Number(plan.precio_mensual) === 0
                        ? "Gratis"
                        : `${moneda(plan.precio_mensual, plan.moneda)}/mes`}
                    </span>
                    <span className="col-plan__meta">
                      {plan.negocios} {plan.negocios === 1 ? "empresa" : "empresas"}
                      {plan.es_predeterminado && " · por defecto"}
                    </span>
                  </th>
                ))}
                <th className="col-estado">En Crynex</th>
              </tr>
            </thead>

            <tbody>
              {porModulo.map(([modulo, delModulo]) => (
                <Fragment key={modulo}>
                  <tr className="fila-modulo">
                    <td colSpan={planes.length + 2}>{modulo}</td>
                  </tr>

                  {delModulo.map((permiso) => (
                    <tr
                      key={permiso.id}
                      className={permiso.activo ? undefined : "esta-retirado"}
                    >
                      <td className="col-permiso">
                        <button
                          type="button"
                          className="permiso__etiqueta permiso__etiqueta--editable"
                          onClick={() => setEditando(permiso)}
                          title="Editar este permiso"
                        >
                          {permiso.etiqueta} <Pencil size={11} />
                        </button>
                        <code>{permiso.codename}</code>
                      </td>

                      {planes.map((plan) => {
                        const incluido = plan.permisos.includes(permiso.codename);
                        const clave = `${plan.id}:${permiso.codename}`;
                        return (
                          <td key={plan.id} className="celda">
                            <button
                              type="button"
                              className={`casilla ${incluido ? "esta-marcada" : ""}`}
                              onClick={() => alternarCelda(plan.id, permiso.codename)}
                              disabled={guardandoCelda === clave || !permiso.activo}
                              aria-pressed={incluido}
                              aria-label={`${permiso.etiqueta} en ${plan.nombre}`}
                              title={
                                permiso.activo
                                  ? undefined
                                  : "Este permiso está retirado de Crynex"
                              }
                            >
                              {incluido ? <Check size={14} /> : <Minus size={12} />}
                            </button>
                          </td>
                        );
                      })}

                      <td className="col-estado">
                        <button
                          type="button"
                          className={`interruptor ${permiso.activo ? "esta-activo" : ""}`}
                          onClick={() =>
                            permiso.activo ? setRetirando(permiso) : retirar(permiso, true)
                          }
                        >
                          <Power size={12} />
                          {permiso.activo ? "Activo" : "Retirado"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="nota-seccion">
        Los cambios en las casillas se guardan al pulsar.
      </p>

      {retirando && (
        <Confirmar
          titulo={`Retirar ${retirando.etiqueta}`}
          afecta="Todas las empresas de Crynex"
          etiquetaAccion="Retirar el permiso"
          peligrosa
          trabajando={trabajando}
          onCerrar={() => setRetirando(null)}
          onConfirmar={() => retirar(retirando, false)}
          consecuencias={
            <>
              <p>
                Desaparece de todos los negocios a la vez, tengan el plan que
                tengan, y quien lo estuviera usando dejará de ver ese módulo.
              </p>
              <p className="tenue">
                No se borra nada: los planes conservan la casilla y volver a
                activarlo lo restituye tal cual.
              </p>
            </>
          }
        />
      )}

      {creando && (
        <ModalPermiso
          titulo="Nuevo permiso"
          productos={productos}
          onCerrar={() => setCreando(false)}
          onGuardar={async (datos) => {
            await crearPermiso(datos);
            setCreando(false);
            avisar(`${datos.etiqueta} creado. Ya se puede marcar en los planes.`);
          }}
        />
      )}

      {editando && (
        <ModalPermiso
          titulo={`Editar ${editando.etiqueta}`}
          permiso={editando}
          productos={productos}
          onCerrar={() => setEditando(null)}
          onGuardar={async (datos) => {
            await guardarPermiso(editando.id, datos);
            setEditando(null);
            avisar("Permiso actualizado.");
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------ crear/editar

function ModalPermiso({
  titulo,
  permiso,
  productos,
  onCerrar,
  onGuardar,
}: {
  titulo: string;
  /** Si viene, es edición: el codename se ve pero no se toca. */
  permiso?: Permiso;
  productos: { id: number; nombre: string }[];
  onCerrar: () => void;
  onGuardar: (datos: Partial<Permiso>) => Promise<void>;
}) {
  const [producto, setProducto] = useState<string>(
    permiso?.producto != null ? String(permiso.producto) : ""
  );
  const [modulo, setModulo] = useState(permiso?.modulo ?? "");
  const [codename, setCodename] = useState(permiso?.codename ?? "");
  const [etiqueta, setEtiqueta] = useState(permiso?.etiqueta ?? "");
  const [descripcion, setDescripcion] = useState(permiso?.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = codename.trim() && etiqueta.trim() && modulo.trim();

  async function guardar() {
    if (!listo) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        producto: producto ? Number(producto) : null,
        modulo: modulo.trim(),
        codename: codename.trim(),
        etiqueta: etiqueta.trim(),
        descripcion: descripcion.trim(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={guardando} disabled={!listo} onClick={guardar}>
            Guardar
          </Boton>
        </>
      }
    >
      {error && <Aviso>{error}</Aviso>}

      <Campo etiqueta="Producto" ayuda="A qué solución de Crynex pertenece.">
        <select value={producto} onChange={(e) => setProducto(e.target.value)}>
          <option value="">Sin producto</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Módulo" ayuda="La etiqueta con la que se agrupa en esta matriz.">
        <input value={modulo} onChange={(e) => setModulo(e.target.value)} />
      </Campo>

      <Campo
        etiqueta="Codename"
        ayuda={
          permiso
            ? "No se puede cambiar: es la llave que ya usan los planes."
            : 'Formato "app.accion_modelo", por ejemplo "delivery.view_envio".'
        }
      >
        <input
          value={codename}
          disabled={Boolean(permiso)}
          onChange={(e) => setCodename(e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Etiqueta" ayuda="Lo que lee el dueño del negocio al repartirlo.">
        <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
      </Campo>

      <Campo etiqueta="Descripción">
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Campo>
    </Modal>
  );
}
