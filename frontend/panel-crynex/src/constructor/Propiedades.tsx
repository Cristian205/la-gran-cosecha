/**
 * El formulario de un bloque, generado de su esquema.
 *
 * Nada de esto sabe qué es un carrusel ni cuántos pasos tiene "Cómo funciona":
 * lee `esquema_props` y dibuja un campo por propiedad. Es la razón de que el
 * esquema exista en el backend desde el principio — un bloque nuevo trae su
 * formulario puesto, sin tocar el editor.
 *
 * Lo que NO hace: validar. Eso lo hace el servidor al guardar, que es el único
 * sitio donde la regla no se puede saltar. Aquí solo se acotan los números al
 * rango declarado, porque teclear 500 en «cuántos productos» y descubrirlo al
 * guardar es una fricción tonta.
 */
import { Plus, Trash2 } from "lucide-react";
import type { CampoEsquema } from "../api/tienda";
import { Boton } from "../ui/basicos";

interface Props {
  esquema: CampoEsquema | undefined;
  valores: Record<string, unknown>;
  onCambio: (valores: Record<string, unknown>) => void;
}

export function Propiedades({ esquema, valores, onCambio }: Props) {
  const campos = Object.entries(esquema?.properties ?? {});

  if (campos.length === 0) {
    return (
      <p className="tenue">
        Este bloque no tiene opciones: se alimenta solo del contenido que el
        negocio administra.
      </p>
    );
  }

  return (
    <div className="formulario">
      {campos.map(([clave, campo]) => (
        <CampoDeEsquema
          key={clave}
          campo={campo}
          valor={valores[clave]}
          onCambio={(v) => onCambio({ ...valores, [clave]: v })}
        />
      ))}
    </div>
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
      <label className="interruptor-campo">
        <input
          type="checkbox"
          checked={Boolean(valor ?? campo.default ?? false)}
          onChange={(e) => onCambio(e.target.checked)}
        />
        <span>
          <span className="campo__etiqueta">{etiqueta}</span>
          {campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}
        </span>
      </label>
    );
  }

  if (campo.tipo === "enum") {
    return (
      <label className="campo">
        <span className="campo__etiqueta">{etiqueta}</span>
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
        {campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}
      </label>
    );
  }

  if (campo.tipo === "number") {
    return (
      <label className="campo">
        <span className="campo__etiqueta">{etiqueta}</span>
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
            const acotado = Math.min(
              campo.maximo ?? Number.MAX_SAFE_INTEGER,
              Math.max(campo.minimo ?? 0, n)
            );
            onCambio(acotado);
          }}
        />
        {campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}
      </label>
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

  // `string` y cualquier tipo que este panel todavía no dibuje: un campo de
  // texto sirve y no pierde el dato, que es mejor que no mostrarlo.
  const largo = etiqueta.toLowerCase().includes("texto");
  return (
    <label className="campo">
      <span className="campo__etiqueta">{etiqueta}</span>
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
      {campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}
    </label>
  );
}

/**
 * Una lista de elementos, como los pasos de "Cómo funciona".
 *
 * Es la pieza que hace real la promesa de que los pasos ya no son tres fijos:
 * se añaden, se quitan y se ordenan sin que nadie toque una migración.
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

  function actualizar(i: number, nuevo: unknown) {
    onCambio(valor.map((v, j) => (j === i ? nuevo : v)));
  }

  return (
    <div className="lista-esquema">
      <div className="lista-esquema__cabecera">
        <span className="campo__etiqueta">{campo.titulo}</span>
        <Boton
          tamano="pequeno"
          variante="fantasma"
          icono={<Plus size={13} />}
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
          Añadir
        </Boton>
      </div>
      {campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}

      {valor.length === 0 ? (
        <p className="tenue">Todavía no hay ninguno.</p>
      ) : (
        <ol className="lista-esquema__items">
          {valor.map((elemento, i) => (
            <li key={i}>
              <div className="lista-esquema__item">
                <span className="lista-esquema__numero">{i + 1}</span>
                <div className="lista-esquema__campos">
                  {Object.entries(forma?.properties ?? {}).map(([clave, sub]) => (
                    <CampoDeEsquema
                      key={clave}
                      campo={sub}
                      valor={(elemento as Record<string, unknown>)?.[clave]}
                      onCambio={(v) =>
                        actualizar(i, {
                          ...(elemento as Record<string, unknown>),
                          [clave]: v,
                        })
                      }
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="icono-boton"
                  aria-label={`Quitar el elemento ${i + 1}`}
                  onClick={() => onCambio(valor.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
