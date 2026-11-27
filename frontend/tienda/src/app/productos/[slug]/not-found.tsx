/**
 * Una categoría o un producto que no existe en ESTA tienda.
 *
 * Sin este archivo el `notFound()` caía en el `not-found.tsx` de la raíz, que
 * dice «Esta tienda no existe»: falso, la tienda existe y solo falta esta
 * página. Se reutiliza el de las páginas compuestas, que lleva la marca del
 * negocio y su composición de «/_no-encontrada» si la tiene. El estado sigue
 * siendo 404 (y Next añade `noindex`).
 */
export { default } from "../../[ruta]/not-found";
