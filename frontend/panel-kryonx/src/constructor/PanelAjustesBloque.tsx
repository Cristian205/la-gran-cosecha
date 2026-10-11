/**
 * El panel derecho: los ajustes de la sección elegida, en tres pestañas.
 *
 * Contenido y Diseño son exactamente `<Propiedades>` y `<Diseno>` de siempre —
 * no se les tocó ni el esquema ni la lógica de "vacío significa heredado", solo
 * dónde aparecen. "Avanzado" no es nuevo: es donde vivían el selector de
 * variante y la visibilidad por dispositivo antes de tener pestañas, sueltos
 * arriba de un separador.
 */
import { useState } from "react";
import { Monitor, Smartphone, Tablet, Trash2 } from "lucide-react";
import type { Bloque, BloqueColocado, TokenTema } from "../api/tienda";
import { Boton, EstadoVacio } from "../ui/basicos";
import { Diseno } from "./Diseno";
import { Propiedades } from "./Propiedades";

const DISPOSITIVOS = [
  { clave: "escritorio", icono: Monitor, nombre: "Escritorio" },
  { clave: "tablet", icono: Tablet, nombre: "Tablet" },
  { clave: "movil", icono: Smartphone, nombre: "Móvil" },
] as const;

type Pestana = "contenido" | "diseno" | "avanzado";

interface Props {
  bloque: BloqueColocado | null;
  definicion: Bloque | undefined;
  tokens: TokenTema[];
  onActualizar: (id: string, cambios: Partial<BloqueColocado>) => void;
  onQuitar: (id: string) => void;
}

export function PanelAjustesBloque({ bloque, definicion, tokens, onActualizar, onQuitar }: Props) {
  const [pestana, setPestana] = useState<Pestana>("contenido");

  if (!bloque) {
    return (
      <aside className="panel-ajustes panel-ajustes--vacio">
        <EstadoVacio titulo="Nada elegido">
          Selecciona una sección para comenzar a editarla.
        </EstadoVacio>
      </aside>
    );
  }

  return (
    <aside className="panel-ajustes">
      <div className="panel-ajustes__cabecera">
        <p className="constructor__titulo" style={{ marginBottom: 2 }}>
          {definicion?.nombre ?? bloque.tipo}
        </p>
        {definicion?.descripcion && <p className="tenue">{definicion.descripcion}</p>}
      </div>

      <nav className="pestanas pestanas--ajustes">
        <button
          type="button"
          className={pestana === "contenido" ? "active" : undefined}
          onClick={() => setPestana("contenido")}
        >
          Contenido
        </button>
        <button
          type="button"
          className={pestana === "diseno" ? "active" : undefined}
          onClick={() => setPestana("diseno")}
        >
          Diseño
        </button>
        <button
          type="button"
          className={pestana === "avanzado" ? "active" : undefined}
          onClick={() => setPestana("avanzado")}
        >
          Avanzado
        </button>
      </nav>

      <div className="panel-ajustes__cuerpo">
        {pestana === "contenido" && (
          <Propiedades
            esquema={definicion?.esquema_props}
            valores={bloque.props}
            onCambio={(props) => onActualizar(bloque.id, { props })}
          />
        )}

        {pestana === "diseno" && (
          <Diseno
            admitidos={definicion?.tokens_admitidos ?? []}
            tokens={tokens}
            valores={bloque.estilo ?? {}}
            onCambio={(estilo) => onActualizar(bloque.id, { estilo })}
          />
        )}

        {pestana === "avanzado" && (
          <div className="constructor__formulario">
            {definicion && definicion.variantes.length > 0 && (
              <label className="campo">
                <span className="campo__etiqueta">Aspecto</span>
                <select
                  value={bloque.variante}
                  onChange={(e) => onActualizar(bloque.id, { variante: e.target.value })}
                >
                  {definicion.variantes.map((v) => (
                    <option key={v.codigo} value={v.codigo}>
                      {v.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="campo">
              <span className="campo__etiqueta">Visibilidad · comportamiento responsive</span>
              <div className="constructor__dispositivos">
                {DISPOSITIVOS.map(({ clave, icono: Icono, nombre }) => (
                  <button
                    key={clave}
                    type="button"
                    className={`constructor__dispositivo ${bloque.visible[clave] ? "esta-activo" : ""}`}
                    aria-pressed={bloque.visible[clave]}
                    title={nombre}
                    onClick={() =>
                      onActualizar(bloque.id, {
                        visible: { ...bloque.visible, [clave]: !bloque.visible[clave] },
                      })
                    }
                  >
                    <Icono size={15} />
                    {nombre}
                  </button>
                ))}
              </div>
              <span className="campo__ayuda">
                Apagado en un dispositivo, esta sección no se dibuja ahí — no es lo mismo que
                ocultarla del todo.
              </span>
            </div>

            <div className="constructor__pie">
              <Boton
                variante="fantasma"
                tamano="pequeno"
                icono={<Trash2 size={13} />}
                onClick={() => onQuitar(bloque.id)}
              >
                Quitar de la página
              </Boton>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
