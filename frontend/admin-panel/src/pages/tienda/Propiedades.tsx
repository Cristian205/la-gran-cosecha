/**
 * El formulario de un bloque, generado de su esquema.
 *
 * No sabe qué es un carrusel ni cuántos pasos tiene «Cómo funciona»: lee el
 * `esquema_props` que declara el catálogo y dibuja un campo por propiedad. Por
 * eso un bloque nuevo trae su formulario puesto sin tocar este archivo.
 *
 * Lo que NO hace es validar. Eso lo hace el servidor al guardar, que es el
 * único sitio donde la regla no se puede saltar; aquí solo se acotan los
 * números al rango declarado, porque descubrir al guardar que 500 no cabía es
 * una fricción tonta.
 */
import { Plus, Trash2 } from "lucide-react";
import type { CampoEsquema } from "../../api/tienda";

interface Props {
  esquema: CampoEsquema | undefined;
  valores: Record<string, unknown>;
  onCambio: (valores: Record<string, unknown>) => void;
}

export function Propiedades({ esquema, valores, onCambio }: Props) {
  const campos = Object.entries(esquema?.properties ?? {});

  if (campos.length === 0) {
    return (
      <p className="campo-ayuda">
        Este bloque no tiene opciones: se alimenta del contenido que administras
        en «Contenido de la tienda».
      </p>
    );
  }

  return (
    <>
      {campos.map(([clave, campo]) => (
        <CampoDeEsquema
          key={clave}
          campo={campo}
          valor={valores[clave]}
          onCambio={(v) => onCambio({ ...valores, [clave]: v })}
        />
      ))}
    </>
  );
}

function CampoDeEsquema({
  campo,
  valor,
  onCambio,
}: {
  campo: CampoEsquema;
  valor: unknown;
  onCambio: (valor: unknown) => void;
}) {
  const etiqueta = campo.titulo ?? "";

  if (campo.tipo === "boolean") {
    return (
      <div className="campo">
        <label className="constructor-switch">
          <input
            type="checkbox"
            checked={Boolean(valor ?? campo.default ?? false)}
            onChange={(e) => onCambio(e.target.checked)}
          />
          <span>{etiqueta}</span>
        </label>
        {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
      </div>
    );
  }

  if (campo.tipo === "enum") {
    return (
      <div className="campo">
        <label>{etiqueta}</label>
        <select
          value={String(valor ?? campo.default ?? "")}
          onChange={(e) => onCambio(e.target.value)}
        >
          {(campo.opciones ?? []).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
      </div>
    );
  }

  if (campo.tipo === "number") {
    return (
      <div className="campo">
        <label>{etiqueta}</label>
        <input
          type="number"
          min={campo.minimo}
          max={campo.maximo}
          // Vacío se guarda como ausente y no como 0: en casi todos los
          // bloques «sin límite» y «cero» son cosas distintas.
          value={valor === undefined || valor === null ? "" : String(valor)}
          onChange={(e) => {
            if (e.target.value === "") return onCambio(undefined);
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onCambio(
              Math.min(
                campo.maximo ?? Number.MAX_SAFE_INTEGER,
                Math.max(campo.minimo ?? 0, n)
              )
            );
          }}
        />
        {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
      </div>
    );
  }

  if (campo.tipo === "array") {
    return (
      <ListaDeEsquema
        campo={campo}
        valor={Array.isArray(valor) ? valor : []}
        onCambio={onCambio}
      />
    );
  }

  // `string`, y cualquier tipo que este panel todavía no dibuje: un campo de
  // texto sirve y no pierde el dato, que es mejor que no mostrarlo.
  const largo = etiqueta.toLowerCase().includes("texto");
  return (
    <div className="campo">
      <label>{etiqueta}</label>
      {largo ? (
        <textarea
          rows={2}
          value={String(valor ?? "")}
          onChange={(e) => onCambio(e.target.value)}
        />
      ) : (
        <input
          value={String(valor ?? "")}
          onChange={(e) => onCambio(e.target.value)}
          placeholder={campo.default ? String(campo.default) : undefined}
        />
      )}
      {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
    </div>
  );
}

/**
 * Una lista de elementos, como los pasos de «Cómo funciona».
 *
 * Es lo que hace real que esos pasos ya no sean tres fijos: se añaden y se
 * quitan aquí, sin que nadie toque una migración.
 */
function ListaDeEsquema({
  campo,
  valor,
  onCambio,
}: {
  campo: CampoEsquema;
  valor: unknown[];
  onCambio: (valor: unknown[]) => void;
}) {
  const forma = campo.items;

  return (
    <div className="campo">
      <div className="constructor-lista-cabecera">
        <label>{campo.titulo}</label>
        <button
          type="button"
          className="btn secundario btn-pequeno"
          onClick={() =>
            onCambio([
              ...valor,
              Object.fromEntries(
                Object.entries(forma?.properties ?? {}).map(([k, c]) => [
                  k,
                  c.default ?? "",
                ])
              ),
            ])
          }
        >
          <Plus size={13} /> Añadir
        </button>
      </div>
      {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}

      {valor.length === 0 ? (
        <p className="campo-ayuda">Todavía no hay ninguno.</p>
      ) : (
        <ol className="constructor-lista">
          {valor.map((elemento, i) => (
            <li key={i}>
              <span className="constructor-lista-numero">{i + 1}</span>
              <div className="constructor-lista-campos">
                {Object.entries(forma?.properties ?? {}).map(([clave, sub]) => (
                  <CampoDeEsquema
                    key={clave}
                    campo={sub}
                    valor={(elemento as Record<string, unknown>)?.[clave]}
                    onCambio={(v) =>
                      onCambio(
                        valor.map((x, j) =>
                          j === i
                            ? { ...(x as Record<string, unknown>), [clave]: v }
                            : x
                        )
                      )
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Quitar el elemento ${i + 1}`}
                onClick={() => onCambio(valor.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
