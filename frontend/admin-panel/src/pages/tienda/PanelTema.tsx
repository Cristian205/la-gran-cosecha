import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { ETIQUETA_GRUPO, type TokenTema } from "../../api/tienda";

interface Props {
  catalogo: TokenTema[];
  /** Lo que este negocio ha cambiado, por código de token. */
  valores: Record<string, string>;
  onCambio: (valores: Record<string, string>) => void;
}

/**
 * La apariencia de la tienda, perilla a perilla.
 *
 * El catálogo lo define Crynex y aquí solo se eligen valores. Es la mitad que
 * faltaba: hasta ahora el negocio solo podía cambiar los cuatro campos de
 * siempre —color, fuente, radio del botón— y todo lo demás que el motor sabe
 * ajustar quedaba en manos de la plataforma.
 *
 * Un valor vacío NO se guarda: se borra la clave. La diferencia importa porque
 * `tema.resolver()` mezcla tres capas —catálogo, plantilla, negocio— y cada una
 * pisa solo lo que declara. Guardar el valor por defecto lo convertiría en una
 * decisión del negocio, y entonces cambiar la plantilla ya no le afectaría.
 */
export function PanelTema({ catalogo, valores, onCambio }: Props) {
  const porGrupo = useMemo(() => {
    const mapa = new Map<string, TokenTema[]>();
    for (const token of catalogo) {
      const lista = mapa.get(token.grupo) ?? [];
      lista.push(token);
      mapa.set(token.grupo, lista);
    }
    return [...mapa.entries()];
  }, [catalogo]);

  function fijar(codigo: string, valor: string) {
    const siguiente = { ...valores };
    if (valor === "") delete siguiente[codigo];
    else siguiente[codigo] = valor;
    onCambio(siguiente);
  }

  if (catalogo.length === 0) {
    return <p className="vacio">Todavía no hay nada que ajustar.</p>;
  }

  return (
    <div className="panel-tema">
      {porGrupo.map(([grupo, tokens]) => (
        <section key={grupo}>
          <h4>{ETIQUETA_GRUPO[grupo as TokenTema["grupo"]] ?? grupo}</h4>

          {tokens.map((token) => {
            const propio = valores[token.codigo];
            // Lo que se ve es el valor efectivo; lo que se guarda, solo lo
            // propio. Enseñar el campo vacío haría creer que no hay nada
            // puesto cuando sí lo hay: lo que trajo la plantilla.
            const efectivo = propio ?? token.valor_por_defecto;

            return (
              <div className="campo" key={token.codigo}>
                <label>
                  {token.nombre}
                  {propio !== undefined && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Volver al valor de la plantilla"
                      onClick={() => fijar(token.codigo, "")}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </label>

                {token.tipo === "COLOR" ? (
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(efectivo) ? efectivo : "#000000"}
                    onChange={(e) => fijar(token.codigo, e.target.value)}
                  />
                ) : token.tipo === "OPCION" ? (
                  <select
                    value={efectivo}
                    onChange={(e) => fijar(token.codigo, e.target.value)}
                  >
                    {token.opciones.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                ) : token.tipo === "MEDIDA" || token.tipo === "NUMERO" ? (
                  <input
                    type="number"
                    value={efectivo}
                    onChange={(e) => fijar(token.codigo, e.target.value)}
                  />
                ) : (
                  <input
                    value={efectivo}
                    onChange={(e) => fijar(token.codigo, e.target.value)}
                  />
                )}

                {token.descripcion && (
                  <small className="campo-ayuda">{token.descripcion}</small>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
