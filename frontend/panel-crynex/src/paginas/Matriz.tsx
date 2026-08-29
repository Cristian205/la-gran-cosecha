import { Check, Loader2, Minus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/cliente";
import type { Permiso, Plan } from "../api/tipos";

/**
 * La matriz: qué concede cada plan.
 *
 * Es la pantalla central del panel y la razón de que exista. Se dibuja como
 * tabla —permisos en filas, planes en columnas— porque la pregunta que responde
 * es comparativa: no "¿qué tiene Growth?" sino "¿qué diferencia hay entre
 * Starter y Growth?". Una lista por plan obligaría a recordar la anterior.
 *
 * Las celdas se guardan al pulsarlas, sin botón de guardar. Es un panel
 * interno de poca gente y el cambio es de un solo dato; un formulario con
 * confirmación solo añadiría un paso donde no hay ambigüedad.
 */
export function Matriz() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Permiso[]>("/platform/permissions/"),
      api.get<Plan[]>("/platform/plans/"),
    ])
      .then(([p, pl]) => {
        setPermisos(p);
        setPlanes(pl);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  /** Los permisos agrupados por módulo, que es como se leen. */
  const porModulo = useMemo(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const permiso of permisos) {
      if (!grupos.has(permiso.modulo)) grupos.set(permiso.modulo, []);
      grupos.get(permiso.modulo)!.push(permiso);
    }
    return [...grupos.entries()];
  }, [permisos]);

  async function alternarCelda(plan: Plan, codename: string) {
    const clave = `${plan.id}:${codename}`;
    const incluido = plan.permisos.includes(codename);
    const siguiente = incluido
      ? plan.permisos.filter((c) => c !== codename)
      : [...plan.permisos, codename];

    setGuardando(clave);
    setError(null);
    // Se pinta antes de que el servidor conteste: la respuesta tarda poco y
    // ver la celda cambiar al instante es lo que hace usable una tabla de 45
    // casillas.
    setPlanes((previos) =>
      previos.map((p) => (p.id === plan.id ? { ...p, permisos: siguiente } : p))
    );

    try {
      const actualizado = await api.patch<Plan>(`/platform/plans/${plan.id}/`, {
        permisos: siguiente,
      });
      setPlanes((previos) =>
        previos.map((p) => (p.id === plan.id ? actualizado : p))
      );
    } catch (e) {
      // Se revierte: dejar la celda cambiada mentiría sobre lo que hay guardado.
      setPlanes((previos) =>
        previos.map((p) => (p.id === plan.id ? plan : p))
      );
      setError((e as Error).message);
    } finally {
      setGuardando(null);
    }
  }

  async function alternarPermiso(permiso: Permiso) {
    setGuardando(permiso.codename);
    setError(null);
    try {
      const actualizado = await api.patch<Permiso>(
        `/platform/permissions/${permiso.id}/`,
        { activo: !permiso.activo }
      );
      setPermisos((previos) =>
        previos.map((p) => (p.id === permiso.id ? actualizado : p))
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) {
    return (
      <div className="cargando">
        <Loader2 className="girando" size={18} /> Cargando la matriz…
      </div>
    );
  }

  return (
    <section>
      <header className="cabecera-pagina">
        <div>
          <h1>Planes y permisos</h1>
          <p className="ayuda">
            Qué puede hacer cada empresa según el plan que tenga contratado.
            Un permiso desactivado desaparece de todos los negocios, sea cual
            sea su plan.
          </p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="scroll-tabla">
        <table className="matriz">
          <thead>
            <tr>
              <th className="col-permiso">Permiso</th>
              {planes.map((plan) => (
                <th key={plan.id} className="col-plan">
                  <span className="plan-nombre">{plan.nombre}</span>
                  <span className="plan-meta">
                    {Number(plan.precio_mensual) === 0
                      ? "Gratis"
                      : `$${Number(plan.precio_mensual).toLocaleString("es-CO")}`}
                  </span>
                  <span className="plan-meta">
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
              <>
                <tr key={modulo} className="fila-modulo">
                  <td colSpan={planes.length + 2}>{modulo}</td>
                </tr>

                {delModulo.map((permiso) => (
                  <tr
                    key={permiso.id}
                    className={permiso.activo ? undefined : "permiso-inactivo"}
                  >
                    <td className="col-permiso">
                      <span className="permiso-etiqueta">{permiso.etiqueta}</span>
                      <code>{permiso.codename}</code>
                    </td>

                    {planes.map((plan) => {
                      const incluido = plan.permisos.includes(permiso.codename);
                      const clave = `${plan.id}:${permiso.codename}`;
                      return (
                        <td key={plan.id} className="celda">
                          <button
                            type="button"
                            className={`casilla ${incluido ? "si" : "no"}`}
                            onClick={() => alternarCelda(plan, permiso.codename)}
                            disabled={guardando === clave || !permiso.activo}
                            aria-pressed={incluido}
                            aria-label={`${permiso.etiqueta} en ${plan.nombre}`}
                            title={
                              permiso.activo
                                ? undefined
                                : "Este permiso está retirado de Crynex"
                            }
                          >
                            {incluido ? <Check size={15} /> : <Minus size={13} />}
                          </button>
                        </td>
                      );
                    })}

                    <td className="col-estado">
                      <button
                        type="button"
                        className={`interruptor ${permiso.activo ? "on" : "off"}`}
                        onClick={() => alternarPermiso(permiso)}
                        disabled={guardando === permiso.codename}
                      >
                        <Power size={13} />
                        {permiso.activo ? "Activo" : "Retirado"}
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ayuda pie-tabla">
        Los cambios se guardan al pulsar. Lo que marques aquí decide qué
        permisos puede repartir cada empresa entre su propio equipo.
      </p>
    </section>
  );
}
