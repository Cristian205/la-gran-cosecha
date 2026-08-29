import { Building2, Layers, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/cliente";
import type { Resumen as DatosResumen } from "../api/tipos";

/** Las cifras de Crynex entero, no las de ningún negocio. */
export function Resumen() {
  const [datos, setDatos] = useState<DatosResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DatosResumen>("/platform/resumen/")
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!datos) return <div className="cargando">Cargando…</div>;

  return (
    <section>
      <header className="cabecera-pagina">
        <div>
          <h1>Crynex</h1>
          <p className="ayuda">La plataforma, vista desde arriba.</p>
        </div>
      </header>

      <div className="tarjetas">
        <article className="tarjeta">
          <span className="icono"><Building2 size={18} /></span>
          <strong>{datos.negocios_total}</strong>
          <span>empresas</span>
        </article>
        <article className="tarjeta">
          <span className="icono"><Layers size={18} /></span>
          <strong>{datos.planes.length}</strong>
          <span>planes</span>
        </article>
        <article className="tarjeta">
          <span className="icono"><ShieldCheck size={18} /></span>
          <strong>{datos.permisos_activos}</strong>
          <span>permisos activos</span>
        </article>
      </div>

      <div className="dos-columnas">
        <div className="bloque">
          <h2>Empresas por plan</h2>
          <ul className="lista-datos">
            {datos.planes.map((fila) => (
              <li key={fila.plan}>
                <span>{fila.plan}</span>
                <strong>{fila.negocios}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="bloque">
          <h2>Empresas por estado</h2>
          <ul className="lista-datos">
            {Object.entries(datos.negocios_por_estado).map(([estado, n]) => (
              <li key={estado}>
                <span>{estado.toLowerCase()}</span>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
          {Object.keys(datos.negocios_por_estado).length === 0 && (
            <p className="ayuda">Sin empresas todavía.</p>
          )}
        </div>
      </div>
    </section>
  );
}
