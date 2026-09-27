/**
 * El formulario de un bloque, generado de su esquema.
 *
 * No sabe qué es un carrusel ni cuántos pasos tiene «Cómo funciona»: lee el
 * `esquema_props` que declara el catálogo y dibuja un campo por propiedad. Por
 * eso un bloque nuevo trae su formulario puesto sin tocar este archivo.
 *
 * El `formato` de cada campo decide el control: una foto se sube o se elige
 * de la biblioteca con vista previa (`CampoMedio`), un destino ofrece las
 * rutas de la tienda (`CampoEnlace`), una lista de productos se elige del
 * catálogo (`CampoProductos`). Si el esquema no lo declara, se deduce del
 * nombre de la propiedad, que es la convención de todos los bloques.
 *
 * Lo que NO hace es validar. Eso lo hace el servidor al guardar, que es el
 * único sitio donde la regla no se puede saltar; aquí solo se acotan los
 * números al rango declarado, porque descubrir al guardar que 500 no cabía es
 * una fricción tonta.
 */
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CampoEsquema } from "../../api/tienda";
import { CampoEnlace } from "./campos/CampoEnlace";
import { CampoMedio, urlDeVista } from "./campos/CampoMedio";
import { CampoProductos } from "./campos/CampoProductos";

interface Props {
  esquema: CampoEsquema | undefined;
  valores: Record<string, unknown>;
  onCambio: (valores: Record<string, unknown>) => void;
}

/** El formato declarado o, si falta, el que sugiere el nombre de la propiedad. */
function formatoDe(clave: string, campo: CampoEsquema): CampoEsquema["formato"] {
  if (campo.formato) return campo.formato;
  if (campo.tipo !== "string") return undefined;
  if (/^(imagen|imagen_movil|poster_url|logo|logo_url|foto|fondo)$/.test(clave)) return "imagen";
  if (/^(video_url|video_movil_url)$/.test(clave)) return "video";
  if (clave === "href" || clave.endsWith("_href")) return "enlace";
  return undefined;
}

export function Propiedades({ esquema, valores, onCambio }: Props) {
  const campos = Object.entries(esquema?.properties ?? {});

  if (campos.length === 0) {
    return (
      <p className="campo-ayuda">
        Este bloque no tiene opciones: se alimenta del contenido que administras
        en Configuración (banners, anuncios, beneficios, testimonios…).
      </p>
    );
  }

  return (
    <>
      {campos.map(([clave, campo]) => (
        <CampoDeEsquema
          key={clave}
          clave={clave}
          campo={campo}
          valor={valores[clave]}
          onCambio={(v) => onCambio({ ...valores, [clave]: v })}
        />
      ))}
    </>
  );
}

function CampoDeEsquema({
  clave,
  campo,
  valor,
  onCambio,
}: {
  clave: string;
  campo: CampoEsquema;
  valor: unknown;
  onCambio: (valor: unknown) => void;
}) {
  const etiqueta = campo.titulo ?? clave;
  const formato = formatoDe(clave, campo);

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

  if (campo.tipo === "array" && formato === "productos") {
    return (
      <CampoProductos
        etiqueta={etiqueta}
        ayuda={campo.ayuda}
        valor={Array.isArray(valor) ? (valor as unknown[]).map(Number).filter(Number.isFinite) : []}
        onCambio={onCambio}
      />
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

  if (formato === "imagen" || formato === "video") {
    return (
      <CampoMedio
        clave={clave}
        tipo={formato}
        etiqueta={etiqueta}
        ayuda={campo.ayuda}
        valor={String(valor ?? "")}
        onCambio={onCambio}
      />
    );
  }

  if (formato === "enlace") {
    return (
      <CampoEnlace
        etiqueta={etiqueta}
        ayuda={campo.ayuda}
        valor={String(valor ?? "")}
        placeholder={campo.default ? String(campo.default) : undefined}
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

/** Los campos que mejor nombran un elemento, en orden de preferencia. */
const CLAVES_DE_TITULO = ["titulo", "nombre", "etiqueta", "palabra", "texto"];

/** Lo que identifica un elemento plegado: su título, o su primer texto con contenido. */
function resumen(elemento: unknown, forma: CampoEsquema | undefined): string {
  if (typeof elemento !== "object" || elemento === null) return String(elemento ?? "");
  const registro = elemento as Record<string, unknown>;
  for (const clave of CLAVES_DE_TITULO) {
    const v = registro[clave];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const [clave, sub] of Object.entries(forma?.properties ?? {})) {
    const v = (elemento as Record<string, unknown>)[clave];
    if (sub.tipo === "string" && !formatoDe(clave, sub) && typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function miniatura(elemento: unknown, forma: CampoEsquema | undefined): string | null {
  if (typeof elemento !== "object" || elemento === null) return null;
  for (const [clave, sub] of Object.entries(forma?.properties ?? {})) {
    const v = (elemento as Record<string, unknown>)[clave];
    if (formatoDe(clave, sub) === "imagen" && typeof v === "string" && v) return v;
  }
  return null;
}

/**
 * Una lista de elementos: los slides de un carrusel, los pasos de «Cómo
 * funciona», las escenas de una historia.
 *
 * Se añaden, se quitan, se duplican y se REORDENAN (el orden de la lista es
 * el orden en la tienda). Cada elemento se pliega a una línea con su texto y
 * su foto, para que una lista de ocho slides no sea una pared de campos.
 * También admite listas de textos simples (`items.tipo = "string"`).
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
  const simple = !forma || forma.tipo !== "object";
  const [abiertos, setAbiertos] = useState<Set<number>>(() => new Set(valor.length <= 1 ? [0] : []));

  function nuevo(): unknown {
    if (simple) return forma?.tipo === "number" ? 0 : "";
    return Object.fromEntries(Object.entries(forma?.properties ?? {}).map(([k, c]) => [k, c.default ?? (c.tipo === "array" ? [] : "")]));
  }

  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= valor.length) return;
    const copia = [...valor];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onCambio(copia);
    setAbiertos((prev) => {
      const s = new Set<number>();
      prev.forEach((k) => s.add(k === i ? j : k === j ? i : k));
      return s;
    });
  }

  function alternar(i: number) {
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });
  }

  return (
    <div className="campo">
      <div className="constructor-lista-cabecera">
        <label>{campo.titulo}</label>
        <button
          type="button"
          className="btn secundario btn-pequeno"
          onClick={() => {
            onCambio([...valor, nuevo()]);
            setAbiertos((prev) => new Set(prev).add(valor.length));
          }}
        >
          <Plus size={13} /> Añadir
        </button>
      </div>
      {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}

      {valor.length === 0 ? (
        <p className="campo-ayuda">Todavía no hay ninguno.</p>
      ) : (
        <ol className="constructor-lista">
          {valor.map((elemento, i) => {
            const controles = (
              <span className="constructor-lista-controles">
                <button type="button" className="btn-icon" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir el elemento ${i + 1}`}>
                  <ArrowUp size={13} />
                </button>
                <button type="button" className="btn-icon" onClick={() => mover(i, 1)} disabled={i === valor.length - 1} aria-label={`Bajar el elemento ${i + 1}`}>
                  <ArrowDown size={13} />
                </button>
                {!simple && (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => onCambio([...valor.slice(0, i + 1), structuredClone(elemento), ...valor.slice(i + 1)])}
                    aria-label={`Duplicar el elemento ${i + 1}`}
                  >
                    <Copy size={13} />
                  </button>
                )}
                <button type="button" className="btn-icon peligro" aria-label={`Quitar el elemento ${i + 1}`} onClick={() => onCambio(valor.filter((_, j) => j !== i))}>
                  <Trash2 size={13} />
                </button>
              </span>
            );

            if (simple) {
              return (
                <li key={i} className="constructor-lista-simple">
                  <span className="constructor-lista-numero">{i + 1}</span>
                  <input
                    value={String(elemento ?? "")}
                    onChange={(e) => onCambio(valor.map((x, j) => (j === i ? (forma?.tipo === "number" ? Number(e.target.value) : e.target.value) : x)))}
                    aria-label={`${campo.titulo ?? "Elemento"} ${i + 1}`}
                  />
                  {controles}
                </li>
              );
            }

            const abierto = abiertos.has(i);
            const foto = miniatura(elemento, forma);
            return (
              <li key={i} className={`constructor-lista-item ${abierto ? "abierto" : ""}`}>
                <div className="constructor-lista-resumen">
                  <button type="button" className="constructor-lista-plegar" onClick={() => alternar(i)} aria-expanded={abierto}>
                    <span className="constructor-lista-numero">{i + 1}</span>
                    {foto && <img src={urlDeVista(foto)} alt="" />}
                    <span className="constructor-lista-titulo">{resumen(elemento, forma) || "Sin título"}</span>
                    <ChevronDown size={14} className="constructor-lista-flecha" />
                  </button>
                  {controles}
                </div>
                {abierto && (
                  <div className="constructor-lista-campos">
                    {Object.entries(forma?.properties ?? {}).map(([clave, sub]) => (
                      <CampoDeEsquema
                        key={clave}
                        clave={clave}
                        campo={sub}
                        valor={(elemento as Record<string, unknown>)?.[clave]}
                        onCambio={(v) =>
                          onCambio(valor.map((x, j) => (j === i ? { ...(x as Record<string, unknown>), [clave]: v } : x)))
                        }
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
