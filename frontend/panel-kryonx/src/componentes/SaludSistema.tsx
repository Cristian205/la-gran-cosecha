/**
 * System Health: cada servicio con su estado medido y su latencia.
 *
 * Los datos salen de `ProveedorSalud`, que sondea de verdad cada minuto. La
 * tarjeta dice cuándo fue la última comprobación y deja repetirla: un estado
 * sin fecha no sirve para decidir nada.
 */
import { RefreshCw } from "lucide-react";
import { ETIQUETA_SERVICIO, TONO_SERVICIO, usarSalud } from "../datos/salud";
import { hora } from "../datos/formato";

export function SaludSistema() {
  const { servicios, comprobadoEn, comprobando, comprobar } = usarSalud();

  return (
    <section className="tarjeta salud">
      <header className="tarjeta__cabecera">
        <h2>System Health</h2>
        <button
          type="button"
          className="icono-boton"
          onClick={() => void comprobar()}
          disabled={comprobando}
          aria-label="Comprobar ahora"
          data-pista="Comprobar ahora"
        >
          <RefreshCw size={14} className={comprobando ? "girando" : undefined} />
        </button>
      </header>
      <ul className="salud__lista">
        {servicios.map((s) => (
          <li key={s.id} className="salud__fila">
            <span className={`pulso pulso--${TONO_SERVICIO[s.estado]}`} aria-hidden="true" />
            <span className="salud__textos">
              <strong>{s.nombre}</strong>
              <span>{s.detalle}</span>
            </span>
            <span className="salud__estado">
              <span className={`salud__etiqueta salud__etiqueta--${TONO_SERVICIO[s.estado]}`}>
                {ETIQUETA_SERVICIO[s.estado]}
              </span>
              {s.latencia !== null && s.estado !== "caido" && (
                <span className="salud__latencia">{s.latencia} ms</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <footer className="tarjeta__pie">
        <span className="tenue">
          {comprobadoEn ? `Comprobado a las ${hora(comprobadoEn.toISOString())}` : "Comprobando…"}
          {" · cada minuto"}
        </span>
      </footer>
    </section>
  );
}
