import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/cliente";
import type { Negocio, Plan } from "../api/tipos";

const COLOR_ESTADO: Record<string, string> = {
  ACTIVO: "ok",
  PRUEBA: "aviso",
  SUSPENDIDO: "malo",
  ARCHIVADO: "neutro",
};

/** Las empresas que usan Crynex, y en qué plan está cada una. */
export function Negocios() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Negocio[]>("/platform/tenants/"),
      api.get<Plan[]>("/platform/plans/"),
    ])
      .then(([n, p]) => {
        setNegocios(n);
        setPlanes(p.filter((x) => x.activo));
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function cambiarPlan(negocio: Negocio, slug: string) {
    setMoviendo(negocio.id);
    setError(null);
    try {
      await api.post(`/platform/tenants/${negocio.id}/cambiar-plan/`, { plan: slug });
      const plan = planes.find((p) => p.slug === slug)!;
      setNegocios((previos) =>
        previos.map((n) =>
          n.id === negocio.id
            ? { ...n, plan: { slug: plan.slug, nombre: plan.nombre } }
            : n
        )
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoviendo(null);
    }
  }

  if (cargando) {
    return (
      <div className="cargando">
        <Loader2 className="girando" size={18} /> Cargando empresas…
      </div>
    );
  }

  return (
    <section>
      <header className="cabecera-pagina">
        <div>
          <h1>Empresas</h1>
          <p className="ayuda">
            Cada una tiene su catálogo, sus pedidos y sus clientes, completamente
            separados. Desde aquí solo se decide su plan.
          </p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="scroll-tabla">
        <table className="tabla">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Estado</th>
              <th>Dominios</th>
              <th className="num">Usuarios</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {negocios.map((negocio) => (
              <tr key={negocio.id}>
                <td>
                  <span className="negocio-nombre">{negocio.nombre}</span>
                  <code>{negocio.slug}</code>
                </td>
                <td>
                  <span className={`pastilla ${COLOR_ESTADO[negocio.estado] ?? "neutro"}`}>
                    {negocio.estado.toLowerCase()}
                  </span>
                </td>
                <td className="dominios">
                  {negocio.dominios.length ? (
                    negocio.dominios.slice(0, 2).map((d) => <code key={d}>{d}</code>)
                  ) : (
                    <span className="ayuda">sin dominio</span>
                  )}
                  {negocio.dominios.length > 2 && (
                    <span className="ayuda">+{negocio.dominios.length - 2}</span>
                  )}
                </td>
                <td className="num">{negocio.usuarios}</td>
                <td>
                  <select
                    value={negocio.plan?.slug ?? ""}
                    disabled={moviendo === negocio.id}
                    onChange={(e) => cambiarPlan(negocio, e.target.value)}
                  >
                    {!negocio.plan && <option value="">— sin plan —</option>}
                    {planes.map((plan) => (
                      <option key={plan.slug} value={plan.slug}>
                        {plan.nombre}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {negocios.length === 0 && (
        <p className="ayuda">Todavía no hay ninguna empresa dada de alta.</p>
      )}
    </section>
  );
}
