/**
 * El constructor de tiendas, en lo que los dos paneles tienen en comun.
 *
 * Se importa con el alias `@constructor` —declarado en el `vite.config.ts` y en
 * el `tsconfig.json` de cada panel— y no como paquete de npm. Ver `tipos.ts`
 * para por que.
 *
 * Lo que hay aqui es TypeScript puro: tipos y transformaciones de listas. Lo
 * que NO hay son componentes, y tampoco es una carencia: los dos paneles tienen
 * hojas de estilos distintas a proposito, asi que compartir la pantalla
 * obligaria a imponerle a uno el vocabulario de clases del otro.
 */
export * from "./tipos";
export * from "./composicion";
export * from "./diseno";
