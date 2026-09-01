/**
 * Tailwind en el panel de Crynex.
 *
 * El reparto es deliberado: las utilidades resuelven la disposición —rejillas,
 * separaciones, alineación— que es distinta en cada pantalla y no merece un
 * nombre propio; el sistema de diseño (botones, insignias, tablas, tarjetas)
 * vive en `estilos.css` dentro de `@layer components`, porque repetir catorce
 * utilidades cada vez que aparece un botón es exactamente cómo un botón acaba
 * teniendo catorce variantes distintas.
 *
 * Los colores no se declaran aquí con su valor: apuntan a las variables CSS de
 * `:root`. Así una utilidad de Tailwind y una regla escrita a mano usan
 * literalmente el mismo token, y cambiar el acento de la marca sigue siendo un
 * cambio en un solo sitio.
 */
const token = (nombre) => `var(--${nombre})`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // El panel es oscuro siempre: no hay conmutador de tema que sincronizar.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        lienzo: token("lienzo"),
        superficie: {
          DEFAULT: token("superficie"),
          alta: token("superficie-alta"),
          viva: token("superficie-viva"),
        },
        linea: {
          DEFAULT: token("linea"),
          viva: token("linea-viva"),
        },
        texto: {
          DEFAULT: token("texto"),
          medio: token("texto-medio"),
          tenue: token("texto-tenue"),
        },
        marca: {
          DEFAULT: token("marca"),
          viva: token("marca-viva"),
          tenue: token("marca-tenue"),
          linea: token("marca-linea"),
        },
        ok: token("ok"),
        aviso: token("aviso"),
        malo: token("malo"),
        info: token("info"),
      },
      borderRadius: {
        s: token("radio-s"),
        DEFAULT: token("radio"),
        l: token("radio-l"),
      },
      boxShadow: {
        flotante: token("sombra"),
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      maxWidth: {
        lectura: "72ch",
      },
    },
  },
  plugins: [],
};
