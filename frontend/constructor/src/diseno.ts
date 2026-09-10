/**
 * La lógica del aspecto propio de un bloque, sin la pantalla.
 *
 * Los dos paneles dibujan esta pestaña con clases distintas —`constructor__grupo`
 * en el de Crynex, `constructor-grupo` en el del negocio— pero deciden lo mismo:
 * qué tokens salen, en qué orden, agrupados cómo, y qué significa dejar uno en
 * blanco. Eso es lo que está aquí.
 */
import type { GrupoToken, TokenTema } from "./tipos";

/**
 * Los tokens que este bloque admite, agrupados y en el orden del catálogo.
 *
 * Se recorre el CATÁLOGO y no la lista del bloque, y esa dirección importa: el
 * orden y el agrupado los decidió la plataforma, y respetarlos hace que la
 * pestaña se vea igual en todos los bloques. Recorriendo la lista del bloque,
 * el orden sería el que tuviera la migración que la escribió.
 *
 * Un token que el bloque nombre y que el catálogo ya no tenga sencillamente no
 * aparece — lo mismo que hace el servidor al guardar.
 */
export function tokensDelBloque(
  admitidos: string[] | undefined,
  catalogo: TokenTema[]
): { grupo: GrupoToken; tokens: TokenTema[] }[] {
  const permitidos = new Set(admitidos ?? []);
  const grupos = new Map<GrupoToken, TokenTema[]>();

  for (const token of catalogo) {
    if (!token.activo || !permitidos.has(token.codigo)) continue;
    const suyos = grupos.get(token.grupo);
    if (suyos) suyos.push(token);
    else grupos.set(token.grupo, [token]);
  }

  return [...grupos.entries()].map(([grupo, tokens]) => ({ grupo, tokens }));
}

/**
 * Fija —o suelta— un token del estilo de un bloque.
 *
 * Vacío significa «que mande el tema de la tienda», no «ponlo en blanco». Son
 * cosas distintas, y confundirlas es lo que hace que un editor de temas resulte
 * imposible de deshacer: si dejar un campo vacío guardara una cadena vacía, la
 * sección se quedaría clavada en ese valor y no volvería a seguir a la tienda
 * cuando el negocio cambiara de color.
 *
 * Por eso se BORRA la clave en vez de guardarla en blanco. El servidor hace lo
 * mismo por su cuenta —`composicion._estilo` descarta los vacíos—: aquí es por
 * comodidad, allí porque es la regla que no se puede saltar.
 */
export function fijarToken(
  valores: Record<string, string>,
  codigo: string,
  valor: string
): Record<string, string> {
  const siguiente = { ...valores };
  if (valor === "") delete siguiente[codigo];
  else siguiente[codigo] = valor;
  return siguiente;
}

/** Si este token lo decide la tienda y no el bloque. */
export function esHeredado(
  valores: Record<string, string>,
  codigo: string
): boolean {
  return valores[codigo] === undefined;
}

/**
 * Traduce el estilo de un bloque —por código de token— a variables CSS.
 *
 * Es el espejo, en el cliente, de `storefront.tema.a_variables` en el
 * servidor. Hace falta uno aquí porque la previa en vivo viaja por
 * `postMessage` y nunca pasa por `composicion.para_la_tienda`, que es donde
 * el servidor hace esta traducción para la tienda publicada. Sin este paso,
 * la tienda dentro del editor recibía el CÓDIGO del token («densidad-escala»)
 * en el atributo `style`, y React lo rechazaba como una propiedad de estilo
 * desconocida en vez de tratarlo como la variable CSS que es.
 *
 * Un código que el catálogo ya no tenga se descarta, igual que hace el
 * servidor: si la tienda dejó de consumirlo, escribirlo no haría nada.
 */
export function variablesDeEstilo(
  estilo: Record<string, string> | undefined,
  catalogo: TokenTema[]
): Record<string, string> {
  if (!estilo) return {};
  const porCodigo = new Map(catalogo.map((t) => [t.codigo, t]));
  const salida: Record<string, string> = {};
  for (const [codigo, bruto] of Object.entries(estilo)) {
    const token = porCodigo.get(codigo);
    if (!token || !token.activo || bruto === "") continue;
    const valor =
      token.unidad && !bruto.endsWith(token.unidad) ? `${bruto}${token.unidad}` : bruto;
    salida[token.variable_css] = valor;
  }
  return salida;
}
