/**
 * El aspecto propio de un bloque, generado de su lista de tokens.
 *
 * Es a `Propiedades.tsx` lo que el diseño es al contenido: aquel lee
 * `esquema_props` y dibuja un campo por propiedad; este lee `tokens_admitidos`
 * y dibuja un control por token. Los dos tienen la misma virtud — un bloque
 * nuevo trae su formulario puesto sin tocar el editor — y la misma frontera:
 * ninguno sabe qué es un carrusel.
 *
 * # Por qué «heredado» es un valor y no un campo vacío
 *
 * Un token sin tocar significa «que mande el tema del negocio», no «ponlo en
 * blanco». Son cosas distintas y confundirlas es lo que hace que un editor de
 * temas resulte imposible de deshacer: si dejar un campo vacío guardara una
 * cadena vacía, la sección se quedaría clavada en ese valor y no volvería a
 * seguir a la tienda cuando el negocio cambiara de color. Por eso el control
 * de color trae su botón de soltar y el resto vuelve a heredar al vaciarse.
 *
 * El servidor hace lo mismo por su cuenta: `composicion._estilo` descarta los
 * vacíos. Aquí se hace por comodidad, allí porque es la única regla que no se
 * puede saltar.
 */
import { RotateCcw } from "lucide-react";
import {
  ETIQUETA_GRUPO,
  fijarToken,
  tokensDelBloque,
  type TokenTema,
} from "../api/tienda";

interface Props {
  /** Los códigos que ESTE bloque admite. Los declara el catálogo. */
  admitidos: string[];
  /** El catálogo completo de tokens, para saber cómo se pinta cada uno. */
  tokens: TokenTema[];
  /** Lo puesto hasta ahora, por código. */
  valores: Record<string, string>;
  onCambio: (valores: Record<string, string>) => void;
}


export function Diseno({ admitidos, tokens, valores, onCambio }: Props) {
  // Agrupar y ordenar lo decide `@constructor`: es la misma decision que toma
  // el otro editor, y solo cambia como se pinta.
  const grupos = tokensDelBloque(admitidos, tokens);

  if (grupos.length === 0) {
    return (
      <p className="tenue">
        Este bloque no tiene aspecto propio: se ve con el tema de la tienda. Para
        cambiarlo, mueve el tema del negocio y cambiará en todas sus secciones.
      </p>
    );
  }

  return (
    <div className="constructor__formulario">
      <p className="tenue">
        Lo que cambies aquí afecta <strong>solo a esta sección</strong>. Lo que
        dejes sin tocar sigue al tema de la tienda.
      </p>

      {grupos.map(({ grupo, tokens: delGrupo }) => (
        <div key={grupo} className="constructor__grupo">
          <p className="constructor__categoria">{ETIQUETA_GRUPO[grupo]}</p>
          {delGrupo.map((token) => (
            <ControlDeToken
              key={token.codigo}
              token={token}
              valor={valores[token.codigo]}
              onCambio={(v) => onCambio(fijarToken(valores, token.codigo, v))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ControlDeToken({
  token,
  valor,
  onCambio,
}: {
  token: TokenTema;
  valor: string | undefined;
  onCambio: (valor: string) => void;
}) {
  const heredado = valor === undefined;

  if (token.tipo === "COLOR") {
    return (
      <label className="campo">
        <span className="campo__etiqueta">{token.nombre}</span>
        <span className="campo__color">
          {/* `<input type=color>` no sabe estar vacío: siempre devuelve un
              color. Por eso el estado «heredado» se enseña al lado y se vuelve
              a él con el botón, no dejando el control en blanco. */}
          <input
            type="color"
            value={valor || token.valor_por_defecto || "#ffffff"}
            onChange={(e) => onCambio(e.target.value)}
          />
          <span className="tenue">{heredado ? "heredado" : valor}</span>
          {!heredado && (
            <button
              type="button"
              className="icono-boton"
              title="Volver al tema de la tienda"
              onClick={() => onCambio("")}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </span>
        {token.descripcion && <span className="campo__ayuda">{token.descripcion}</span>}
      </label>
    );
  }

  if (token.tipo === "OPCION") {
    return (
      <label className="campo">
        <span className="campo__etiqueta">{token.nombre}</span>
        <select value={valor ?? ""} onChange={(e) => onCambio(e.target.value)}>
          <option value="">Heredado del tema</option>
          {(token.opciones ?? []).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.nombre}
            </option>
          ))}
        </select>
        {token.descripcion && <span className="campo__ayuda">{token.descripcion}</span>}
      </label>
    );
  }

  const numerico = token.tipo === "NUMERO" || token.tipo === "MEDIDA";
  return (
    <label className="campo">
      <span className="campo__etiqueta">
        {token.nombre}
        {token.unidad && <span className="tenue"> ({token.unidad})</span>}
      </span>
      <input
        type={numerico ? "number" : "text"}
        step={numerico ? "any" : undefined}
        value={valor ?? ""}
        placeholder={token.valor_por_defecto || "Heredado del tema"}
        onChange={(e) => onCambio(e.target.value)}
      />
      {token.descripcion && <span className="campo__ayuda">{token.descripcion}</span>}
    </label>
  );
}
