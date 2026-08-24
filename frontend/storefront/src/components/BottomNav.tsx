import { NavLink } from "react-router-dom";
import { ENLACES } from "../navegacion";

/**
 * Navegación principal en móvil, fija al borde inferior (patrón de app: las
 * secciones quedan al alcance del pulgar en vez de escondidas tras un menú
 * hamburguesa). En escritorio no se renderiza: ahí manda la barra superior.
 * El carrito y la búsqueda viven arriba, junto al logo.
 */
export function BottomNav() {
  return (
    <nav className="nav-inferior" aria-label="Navegación principal">
      {ENLACES.map(({ to, labelCorto, icono: Icono, fin }) => (
        <NavLink
          key={to}
          to={to}
          end={fin}
          className={({ isActive }) => `nav-inferior-item ${isActive ? "activo" : ""}`}
        >
          <span className="nav-inferior-icono">
            <Icono size={21} strokeWidth={1.9} />
          </span>
          <span className="nav-inferior-txt">{labelCorto}</span>
        </NavLink>
      ))}
    </nav>
  );
}
