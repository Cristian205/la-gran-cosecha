import { Lock } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Una ventana de navegador alrededor de una maqueta. Sin ella una tienda en
 * miniatura parece una ilustración; con ella se lee como un sitio publicado.
 */
export function Marco({
  dominio,
  extra,
  className = "",
  children,
}: {
  dominio: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`marco ${className}`}>
      <div className="marco__barra">
        <span className="marco__semaforo" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="marco__direccion">
          <Lock aria-hidden="true" />
          {dominio}
        </span>
        {extra ?? <span className="marco__hueco" />}
      </div>
      <div className="marco__contenido">{children}</div>
    </div>
  );
}
