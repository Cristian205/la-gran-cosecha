/**
 * El editor de aspecto de una plantilla.
 *
 * Se genera del catálogo de `TokenTema`, igual que el panel de propiedades se
 * genera del esquema de un bloque. No sabe qué es una navbar: sabe que hay un
 * token de tipo COLOR en el grupo «Navegación», y dibuja un selector de color.
 *
 * Añadir «color del pie» al catálogo lo hace aparecer aquí sin tocar este
 * archivo — que es toda la gracia de tener el aspecto en filas y no en
 * columnas.
 */
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import {
  ETIQUETA_GRUPO,
  type GrupoToken,
  type TokenTema,
} from "../api/tienda";

interface Props {
  tokens: TokenTema[];
  /** Lo que esta plantilla cambia, por código. Vacío = el valor del catálogo. */
  valores: Record<string, string>;
  onCambio: (valores: Record<string, string>) => void;
}

export function PanelTema({ tokens, valores, onCambio }: Props) {
  const porGrupo = useMemo(() => {
    const grupos = new Map<GrupoToken, TokenTema[]>();
    for (const token of tokens) {
      if (!token.activo) continue;
      if (!grupos.has(token.grupo)) grupos.set(token.grupo, []);
      grupos.get(token.grupo)!.push(token);
    }
    return [...grupos.entries()];
  }, [tokens]);

  function fijar(codigo: string, valor: string) {
    // Un valor vacío BORRA la clave en vez de guardarse: así el token vuelve al
    // del catálogo. Guardar "" dejaría la plantilla imponiendo un valor vacío,
    // que en CSS es una variable rota.
    const siguiente = { ...valores };
    if (valor === "") delete siguiente[codigo];
    else siguiente[codigo] = valor;
    onCambio(siguiente);
  }

  if (tokens.length === 0) {
    return <p className="tenue">El catálogo de aspecto está vacío.</p>;
  }

  return (
    <div className="tema-panel">
      {porGrupo.map(([grupo, delGrupo]) => (
        <section key={grupo} className="tema-grupo">
          <p className="constructor__categoria">{ETIQUETA_GRUPO[grupo]}</p>
          {delGrupo.map((token) => (
            <Control
              key={token.codigo}
              token={token}
              valor={valores[token.codigo] ?? ""}
              onCambio={(v) => fijar(token.codigo, v)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function Control({
  token,
  valor,
  onCambio,
}: {
  token: TokenTema;
  valor: string;
  onCambio: (valor: string) => void;
}) {
  // Lo que se ve cuando la plantilla no fija nada: el valor del catálogo.
  const efectivo = valor || token.valor_por_defecto;
  const propio = valor !== "";

  return (
    <div className={`tema-control ${propio ? "es-propio" : ""}`}>
      <div className="tema-control__cabecera">
        <span className="campo__etiqueta">{token.nombre}</span>
        {propio && (
          <button
            type="button"
            className="tema-control__reiniciar"
            title="Volver al valor por defecto"
            onClick={() => onCambio("")}
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>

      {token.tipo === "COLOR" ? (
        <div className="tema-color">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(efectivo) ? efectivo : "#000000"}
            onChange={(e) => onCambio(e.target.value)}
          />
          <input
            value={efectivo}
            onChange={(e) => onCambio(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : token.tipo === "OPCION" ? (
        <select value={efectivo} onChange={(e) => onCambio(e.target.value)}>
          {token.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.nombre}
            </option>
          ))}
        </select>
      ) : (
        <div className="tema-medida">
          <input
            type="number"
            step="any"
            value={efectivo}
            onChange={(e) => onCambio(e.target.value)}
          />
          {token.unidad && <span className="tenue">{token.unidad}</span>}
        </div>
      )}

      {token.descripcion && (
        <span className="campo__ayuda">{token.descripcion}</span>
      )}
    </div>
  );
}

/**
 * Las variables CSS de una plantilla, para mandárselas a la vista previa.
 *
 * Repite la resolución que el backend hace en `apps/storefront/tema.py`, y solo
 * para la previa: lo que se guarda son los códigos, no las variables. Si las
 * dos se separaran, lo que se ve al editar dejaría de ser lo que se sirve — y
 * eso lo notaría el cliente, no nosotros.
 */
export function variablesDe(
  tokens: TokenTema[],
  valores: Record<string, string>
): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const token of tokens) {
    if (!token.activo) continue;
    let valor = valores[token.codigo] ?? token.valor_por_defecto;
    if (!valor) continue;
    if (token.unidad && !String(valor).endsWith(token.unidad)) {
      valor = `${valor}${token.unidad}`;
    }
    salida[token.variable_css] = valor;
  }
  return salida;
}
