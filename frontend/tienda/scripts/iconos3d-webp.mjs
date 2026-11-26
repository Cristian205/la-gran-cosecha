/**
 * Genera las versiones WebP de los iconos 3D de `public/icons3d`.
 *
 *     npm run iconos3d
 *
 * Por cada `nombre.png` (256×256) deja:
 *   - `nombre.webp`      256 px: pantallas 3x y los iconos grandes.
 *   - `nombre-128.webp`  128 px: los iconos de hasta 64 px, aun en pantallas 2x.
 *
 * Sin pérdida (`lossless`): los píxeles son los mismos del PNG, solo que
 * comprimidos mejor. Los PNG se conservan porque hay nombres `.png` guardados
 * en el contenido de las tiendas; `rutaIcono3D` los traduce a WebP.
 *
 * Correr de nuevo al agregar o cambiar un icono.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons3d");
const TAMANOS = [
  { lado: 256, sufijo: "" },
  { lado: 128, sufijo: "-128" },
];

let antes = 0;
let despues = 0;
for (const archivo of (await readdir(carpeta)).filter((f) => f.endsWith(".png"))) {
  const png = await readFile(path.join(carpeta, archivo));
  const base = archivo.slice(0, -".png".length);
  antes += png.length;
  for (const { lado, sufijo } of TAMANOS) {
    const webp = await sharp(png)
      .resize(lado, lado, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: true })
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    await writeFile(path.join(carpeta, `${base}${sufijo}.webp`), webp);
    if (lado === 128) despues += webp.length;
  }
}
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`Iconos 3D: ${kb(antes)} en PNG → ${kb(despues)} en WebP de 128 px.`);
