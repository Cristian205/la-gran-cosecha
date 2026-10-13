/**
 * Los adornos de la variante «botánico» de los destacados: ramas de hojas de
 * trazo fino en las esquinas de arriba y curvas orgánicas abajo.
 *
 * SVG en línea y no imágenes: pesan unos cientos de bytes, se tiñen con las
 * variables del bloque (`--ps-dorado`, `--ps-salvia`) y no hacen otra
 * petición. Van detrás del contenido, sin puntero y fuera del árbol de
 * accesibilidad: son decoración y nada más.
 */

/** Una hoja: contorno y nervadura central, en un cuadro de 40×80. */
function Hoja({ transform, relleno = false }: { transform: string; relleno?: boolean }) {
  return (
    <g transform={transform}>
      <path
        d="M20 0C34 18 38 44 20 80C2 44 6 18 20 0Z"
        className={relleno ? "psd-hoja psd-hoja--rellena" : "psd-hoja"}
      />
      <path d="M20 6V76" className="psd-nervio" />
      <path d="M20 26l9-8M20 40l11-9M20 54l9-8M20 26l-9-8M20 40l-11-9M20 54l-9-8" className="psd-nervio psd-nervio--fino" />
    </g>
  );
}

/** Una rama: tallo curvo con hojas a los lados. */
function Rama({ className }: { className: string }) {
  return (
    <svg className={`psd-rama ${className}`} viewBox="0 0 320 260" aria-hidden="true" focusable="false">
      <path d="M8 252C70 196 128 150 196 104S292 30 316 6" className="psd-tallo" />
      <Hoja transform="translate(52 170) rotate(-118) scale(0.9)" relleno />
      <Hoja transform="translate(98 168) rotate(-28) scale(0.8)" />
      <Hoja transform="translate(122 118) rotate(-122) scale(1)" />
      <Hoja transform="translate(176 120) rotate(-36) scale(0.85)" relleno />
      <Hoja transform="translate(196 68) rotate(-130) scale(0.8)" />
      <Hoja transform="translate(248 66) rotate(-42) scale(0.7)" />
    </svg>
  );
}

export function DecoracionBotanica() {
  return (
    <div className="psd" aria-hidden="true">
      <Rama className="psd-rama--izquierda" />
      <Rama className="psd-rama--derecha" />
      <svg className="psd-curvas" viewBox="0 0 900 220" preserveAspectRatio="none" focusable="false">
        <path d="M0 200C180 196 300 150 430 150S700 196 900 60" className="psd-curva psd-curva--dorada" />
        <path d="M0 214C200 210 330 172 470 170S730 206 900 92" className="psd-curva psd-curva--salvia" />
        <path d="M260 220C380 186 520 182 640 200S820 176 900 130" className="psd-curva psd-curva--dorada psd-curva--tenue" />
      </svg>
    </div>
  );
}
