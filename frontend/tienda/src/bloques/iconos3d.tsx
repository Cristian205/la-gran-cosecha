import type { ComponentType } from "react";

/**
 * La misma forma que ya usaban los iconos de lucide en cada bloque
 * (`<Icono size={24} />`, a veces con `strokeWidth` o `aria-hidden`) — así
 * ningún llamador tuvo que cambiar al pasar de un trazo a un render 3D.
 * `strokeWidth` se acepta y se ignora: una imagen no tiene grosor de trazo,
 * pero rechazarlo obligaría a tocar cada sitio que todavía lo pasa.
 */
export interface PropsIcono {
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export type ComponenteIcono = ComponentType<PropsIcono>;

/**
 * Envuelve un PNG de `/public/icons3d` con la interfaz de un icono.
 *
 * Los archivos son el estilo "3D" de Fluent Emoji (Microsoft, MIT): un
 * único render ya iluminado, no un SVG que se pueda teñir con el color de
 * cada tienda — por eso son puramente decorativos, nunca los iconos
 * funcionales (flechas, cerrar, buscar en la barra) que sí necesitan seguir
 * el tema.
 */
export function icono3D(archivo: string): ComponenteIcono {
  function Icono3D({ size = 24, strokeWidth: _strokeWidth, className, ...resto }: PropsIcono) {
    return (
      <img
        src={`/icons3d/${archivo}`}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        decoding="async"
        className={className}
        style={{ display: "inline-block", objectFit: "contain" }}
        {...resto}
      />
    );
  }
  Icono3D.displayName = `Icono3D(${archivo})`;
  return Icono3D;
}
