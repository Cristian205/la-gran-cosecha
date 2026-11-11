/**
 * Las fotos de la tienda viven en Cloudflare R2 tal como las sube cada negocio:
 * PNG o JPG de 1920 px y cientos de KiB, también en un teléfono. Estas
 * funciones las pasan por el optimizador de Next (`/_next/image`), que las
 * redimensiona al ancho pedido, las sirve en WebP y las cachea.
 *
 * Se usa el optimizador por URL y no el componente `next/image` porque el
 * resto de la tienda ya compone `<picture>`/`<img>` a mano (foto de móvil,
 * foto de tablet, encuadre): así esos componentes no cambian de estructura.
 *
 * Reglas del optimizador (Next 16):
 *   · el ancho debe estar en `deviceSizes` o `imageSizes` de `next.config.ts`;
 *   · la calidad debe estar en `qualities` (por defecto, solo 75);
 *   · el origen debe coincidir con `images.remotePatterns`.
 * Cualquier otra cosa (un SVG, un GIF, un `data:`, un host desconocido) se
 * devuelve tal cual: nunca se rompe una foto por querer optimizarla.
 */

/** Anchos permitidos (están en las listas por defecto de Next). */
export const ANCHOS_IMAGEN = [384, 640, 828, 1080, 1200, 1920] as const;
const CALIDAD = 75;

function hostOptimizable(host: string): boolean {
  if (host.endsWith(".r2.dev") || host.endsWith(".cloudflarestorage.com")) return true;
  const propio = process.env.NEXT_PUBLIC_MEDIA_HOST;
  return Boolean(propio) && host === propio;
}

/** ¿Esta URL se puede pasar por el optimizador? */
export function esOptimizable(src: string | null | undefined): src is string {
  if (!src || !/^https:\/\//i.test(src)) return false;
  try {
    const url = new URL(src);
    if (/\.(svg|gif)$/i.test(url.pathname)) return false;
    return hostOptimizable(url.hostname);
  } catch {
    return false;
  }
}

/** La misma foto, redimensionada a `ancho` px (o la original si no se puede). */
export function urlImagen(src: string, ancho: number): string {
  if (!esOptimizable(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${ancho}&q=${CALIDAD}`;
}

/**
 * Un `srcSet` con la foto a varios anchos, para que cada pantalla baje solo lo
 * que necesita. `undefined` si no se puede optimizar: el `<img>` usa `src`.
 */
export function srcSetImagen(
  src: string | null | undefined,
  anchos: readonly number[] = ANCHOS_IMAGEN
): string | undefined {
  if (!esOptimizable(src)) return undefined;
  return anchos.map((w) => `${urlImagen(src, w)} ${w}w`).join(", ");
}
