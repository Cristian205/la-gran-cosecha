/**
 * Las URLs públicas del catálogo. Sin dependencias de servidor: las usan
 * tanto las páginas (servidor) como los bloques interactivos (cliente).
 */

/**
 * La URL propia de una categoría: `/tienda/<slug>`.
 *
 * `null` si el backend todavía no manda el slug (un despliegue del frontend
 * antes que el del backend): quien la pida cae a `/tienda?categoria=<id>`, que
 * sigue funcionando como siempre.
 */
export function rutaDeCategoria(categoria: { slug?: string | null }): string | null {
  return categoria.slug ? `/tienda/${categoria.slug}` : null;
}

export function hrefDeCategoria(categoria: { id: number; slug?: string | null }): string {
  return rutaDeCategoria(categoria) ?? `/tienda?categoria=${categoria.id}`;
}

/** El clic «normal»: con Ctrl/⌘/Mayús o el botón central se quiere otra pestaña. */
export function esClicNormal(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
