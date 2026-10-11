import type { MouseEvent } from "react";
import { Logo } from "../componentes/Logo";
import type { DatosPie } from "../contenido/tipos";
import { irA } from "../hooks/desplazamiento";

export function Pie({ datos }: { datos: DatosPie }) {
  const alPulsar = (evento: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (irA(href)) evento.preventDefault();
  };

  return (
    <footer className="pie">
      <div className="contenedor pie__interior">
        <div className="pie__marca">
          <Logo />
          <span>{datos.lema}</span>
        </div>
        <nav className="pie__enlaces" aria-label="Pie de página">
          {datos.enlaces.map((enlace) => (
            <a key={enlace.href} href={enlace.href} onClick={(e) => alPulsar(e, enlace.href)}>
              {enlace.etiqueta}
            </a>
          ))}
        </nav>
        <span className="pie__legal">
          © {new Date().getFullYear()} {datos.legal}
        </span>
      </div>
    </footer>
  );
}
