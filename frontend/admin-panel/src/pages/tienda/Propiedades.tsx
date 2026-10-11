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
 * Los controles son visuales cuando el dato lo permite: un `enum` corto es un
 * botón segmentado, un número acotado un deslizador, un `enfoque` el control
 * de encuadre, y las fotos de escritorio/tablet/móvil un solo control con una
 * pestaña por pantalla (`ImagenesPorDispositivo`).
 *
 * `claves` limita el formulario a un apartado del panel (Contenido, Botones…):
 * qué propiedad va en cuál lo decide `agrupacion.ts`.
 *
 * Lo que NO hace es validar. Eso lo hace el servidor al guardar, que es el
 * único sitio donde la regla no se puede saltar; aquí solo se acotan los
 * números al rango declarado, porque descubrir al guardar que 500 no cabía es
 * una fricción tonta.
 */
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { CampoEsquema } from "../../api/tienda";
import { grupoDe, nombreDeBoton, prefijoDeBoton } from "./agrupacion";
import { CampoEncuadre } from "./campos/CampoEncuadre";
import { CampoEnlace } from "./campos/CampoEnlace";
import { CampoMedio, urlDeVista } from "./campos/CampoMedio";
import { CampoProductos } from "./campos/CampoProductos";
import { ImagenesPorDispositivo, clavesDeImagenes } from "./campos/ImagenesPorDispositivo";
import type { ClaveDispositivo } from "./dispositivos";

interface Props {
  esquema: CampoEsquema | undefined;
  valores: Record<string, unknown>;
  onCambio: (valores: Record<string, unknown>) => void;
  /** Solo estas propiedades y en este orden (un apartado del panel). Sin ella, todas. */
  claves?: string[];
  /** La pantalla de la previa, que es también la de las fotos por dispositivo. */
  pantalla?: ClaveDispositivo;
  onPantalla?: (clave: ClaveDispositivo) => void;
}

/** El formato declarado o, si falta, el que sugiere el nombre de la propiedad. */
function formatoDe(clave: string, campo: CampoEsquema): CampoEsquema["formato"] {
  if (campo.formato) return campo.formato;
  if (campo.tipo !== "string") return undefined;
  if (/^(imagen|imagen_movil|imagen_tablet|poster_url|logo|logo_url|foto|fondo)$/.test(clave)) return "imagen";
  if (/^(video_url|video_movil_url)$/.test(clave)) return "video";
  if (clave === "href" || clave.endsWith("_href")) return "enlace";
  return undefined;
}

/**
 * La etiqueta que se enseña. Los esquemas viejos hablan de «Enfoque», que es
 * jerga de fotógrafo: lo que el control hace es encuadrar.
 */
function tituloDe(clave: string, campo: CampoEsquema): string {
  const titulo = campo.titulo ?? clave;
  if (/^enfoque/.test(clave)) {
    if (/^Enfoque de la foto$/i.test(titulo)) return "Encuadre de la imagen";
    return titulo.replace(/^Enfoque/i, "Encuadre");
  }
  return titulo;
}

/** El nombre de una opción: el que declara el esquema o el código, legible. */
function etiquetaDeOpcion(campo: CampoEsquema, opcion: string): string {
  const declarada = campo.opciones_etiquetas?.[opcion];
  if (declarada) return declarada;
  const legible = opcion.replace(/[_-]+/g, " ");
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

export function Propiedades({ esquema, valores, onCambio, claves, pantalla = "escritorio", onPantalla }: Props) {
  const [pantallaLocal, setPantallaLocal] = useState<ClaveDispositivo>(pantalla);
  const todas = esquema?.properties ?? {};
  const lista = (claves ?? Object.keys(todas)).filter((clave) => clave in todas);
  const deImagenes = new Set(clavesDeImagenes(esquema));
  const primeraImagen = lista.find((c) => deImagenes.has(c));

  if (lista.length === 0) return null;

  const salida: ReactNode[] = [];
  let botonAnterior: string | null = null;

  for (const clave of lista) {
    const campo = todas[clave];

    // Las fotos por dispositivo son UN control, aunque sean seis propiedades:
    // se pinta en el sitio de la primera y las demás se saltan.
    if (deImagenes.has(clave)) {
      if (clave === primeraImagen) {
        salida.push(
          <ImagenesPorDispositivo
            key="imagenes-por-dispositivo"
            esquema={esquema}
            valores={valores}
            onCambio={(cambios) => onCambio({ ...valores, ...cambios })}
            pantalla={onPantalla ? pantalla : pantallaLocal}
            onPantalla={onPantalla ?? setPantallaLocal}
          />
        );
      }
      continue;
    }

    // Los botones van por tarjetas: «Botón principal», «Botón secundario».
    let atenuado = false;
    if (grupoDe(clave, campo) === "botones") {
      const prefijo = prefijoDeBoton(clave);
      if (prefijo !== botonAnterior) {
        salida.push(
          <p key={`boton-${prefijo}`} className="constructor-subtitulo">
            {nombreDeBoton(prefijo)}
          </p>
        );
        botonAnterior = prefijo;
      }
      atenuado = clave !== `${prefijo}_visible` && valores[`${prefijo}_visible`] === false;
    }

    salida.push(
      <div key={clave} className={atenuado ? "constructor-atenuado" : undefined}>
        <CampoDeEsquema
          clave={clave}
          campo={campo}
          valor={valores[clave]}
          hermanos={valores}
          onCambio={(v) => onCambio({ ...valores, [clave]: v })}
        />
      </div>
    );
  }

  return <>{salida}</>;
}

function CampoDeEsquema({
  clave,
  campo,
  valor,
  hermanos,
  onCambio,
}: {
  clave: string;
  campo: CampoEsquema;
  valor: unknown;
  /** Las demás propiedades del mismo objeto: el encuadre necesita su foto. */
  hermanos?: Record<string, unknown>;
  onCambio: (valor: unknown) => void;
}) {
  const id = useId();
  const etiqueta = tituloDe(clave, campo);
  const formato = formatoDe(clave, campo);

  if (campo.tipo === "boolean") {
    const marcado = Boolean(valor ?? campo.default ?? false);
    return (
      <div className="campo constructor-interruptor">
        <label htmlFor={id}>{etiqueta}</label>
        <label className="switch">
          <input id={id} type="checkbox" role="switch" checked={marcado} onChange={(e) => onCambio(e.target.checked)} />
          <span className="switch-riel" aria-hidden="true" />
        </label>
        {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
      </div>
    );
  }

  if (campo.tipo === "enum") {
    const opciones = campo.opciones ?? [];
    const actual = String(valor ?? campo.default ?? "");
    // Pocas opciones cortas: botones segmentados, que se ven todas de un
    // vistazo. Muchas o largas: un desplegable.
    const segmentado =
      opciones.length > 1 && opciones.length <= 4 && opciones.every((o) => etiquetaDeOpcion(campo, o).length <= 11);
    return (
      <div className="campo">
        <label id={`${id}-etiqueta`} htmlFor={segmentado ? undefined : id}>
          {etiqueta}
        </label>
        {segmentado ? (
          <div className="constructor-segmentado" role="radiogroup" aria-labelledby={`${id}-etiqueta`}>
            {opciones.map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={actual === opcion}
                className={actual === opcion ? "activo" : ""}
                onClick={() => onCambio(opcion)}
              >
                {etiquetaDeOpcion(campo, opcion)}
              </button>
            ))}
          </div>
        ) : (
          <select id={id} value={actual} onChange={(e) => onCambio(e.target.value)}>
            {opciones.map((opcion) => (
              <option key={opcion} value={opcion}>
                {etiquetaDeOpcion(campo, opcion)}
              </option>
            ))}
          </select>
        )}
        {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
      </div>
    );
  }

  if (campo.tipo === "number") {
    // Con un rango corto, un deslizador: se ajusta mirando la previa en vez de
    // adivinando un número.
    const deslizable =
      campo.minimo !== undefined && campo.maximo !== undefined && campo.maximo - campo.minimo <= 200;
    if (deslizable) {
      const bruto = Number(valor ?? campo.default ?? campo.minimo);
      const n = Number.isFinite(bruto) ? bruto : (campo.minimo as number);
      return (
        <div className="campo">
          <label htmlFor={id}>{etiqueta}</label>
          <div className="constructor-deslizador">
            <input
              id={id}
              type="range"
              min={campo.minimo}
              max={campo.maximo}
              value={n}
              onChange={(e) => onCambio(Number(e.target.value))}
            />
            <output htmlFor={id}>{n}</output>
          </div>
          {campo.ayuda && <p className="campo-ayuda">{campo.ayuda}</p>}
        </div>
      );
    }
    return (
      <div className="campo">
        <label htmlFor={id}>{etiqueta}</label>
        <input
          id={id}
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

  if (campo.tipo === "string" && /^enfoque/.test(clave)) {
    // La foto que encuadra: la de la misma pantalla (`enfoque_movil` →
    // `imagen_movil`) o, si no hay, la principal.
    const foto = hermanos?.[clave.replace(/^enfoque/, "imagen")] || hermanos?.imagen;
    return (
      <CampoEncuadre
        etiqueta={etiqueta}
        valor={String(valor ?? "")}
        porDefecto={campo.default ? String(campo.default) : "50% 50%"}
        imagen={typeof foto === "string" && foto ? foto : undefined}
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
  const largo = /texto|subt[ií]tulo|descripci/i.test(etiqueta) && !/bot[oó]n|alternativo/i.test(etiqueta);
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {largo ? (
        <textarea
          id={id}
          rows={2}
          value={String(valor ?? "")}
          onChange={(e) => onCambio(e.target.value)}
        />
      ) : (
        <input
          id={id}
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
                        hermanos={elemento as Record<string, unknown>}
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
