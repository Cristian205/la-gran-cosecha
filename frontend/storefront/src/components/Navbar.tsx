import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useCart } from "../store/cart";
import { BusquedaGlobal } from "./BusquedaGlobal";

interface Props {
  busqueda: string;
  onBuscar: (valor: string) => void;
  onAbrirCarrito: () => void;
}

const ENLACES = [
  { to: "/", label: "Inicio", fin: true },
  { to: "/tienda", label: "Tienda", fin: false },
  { to: "/nosotros", label: "Nosotros", fin: false },
  { to: "/contacto", label: "Contáctanos", fin: false },
];

export function Navbar({ busqueda, onBuscar, onAbrirCarrito }: Props) {
  const totalItems = useCart((s) => s.totalItems());
  const { config } = useSiteConfig();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscadorMovilAbierto, setBuscadorMovilAbierto] = useState(false);

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  function alternarBuscadorMovil() {
    setMenuAbierto(false);
    setBuscadorMovilAbierto((v) => !v);
  }

  function alternarMenu() {
    setBuscadorMovilAbierto(false);
    setMenuAbierto((v) => !v);
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="marca" onClick={cerrarMenu}>
        <span className="logo-circ">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt="La Gran Cosecha"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
            />
          ) : (
            "🌾"
          )}
        </span>
        <span className="marca-txt">La Gran Cosecha</span>
      </NavLink>

      <div className="nav-links">
        {ENLACES.map((e) => (
          <NavLink
            key={e.to}
            to={e.to}
            end={e.fin}
            className={({ isActive }) => (isActive ? "activo" : "")}
          >
            {e.label}
          </NavLink>
        ))}
      </div>

      <BusquedaGlobal busqueda={busqueda} onBuscar={onBuscar} atajoTeclado />

      <button
        className="btn-buscar-movil"
        onClick={alternarBuscadorMovil}
        aria-label={buscadorMovilAbierto ? "Cerrar búsqueda" : "Buscar"}
        aria-expanded={buscadorMovilAbierto}
      >
        {buscadorMovilAbierto ? <X size={20} /> : <Search size={20} />}
      </button>

      <button className="btn-carrito" onClick={onAbrirCarrito}>
        <ShoppingCart size={18} />
        <span className="btn-carrito-txt">Carrito</span>
        {totalItems > 0 && <span className="badge">{totalItems}</span>}
      </button>

      <button
        className="btn-menu-movil"
        onClick={alternarMenu}
        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuAbierto}
      >
        {menuAbierto ? <X size={22} /> : <Menu size={22} />}
      </button>

      {buscadorMovilAbierto && (
        <div className="navbar-buscador-movil">
          <BusquedaGlobal
            busqueda={busqueda}
            onBuscar={onBuscar}
            onNavegar={() => setBuscadorMovilAbierto(false)}
            autoFocus
          />
        </div>
      )}

      {menuAbierto && (
        <>
          <div className="menu-movil-overlay" onClick={cerrarMenu} />
          <div className="menu-movil">
            <div className="nav-links-movil">
              {ENLACES.map((e) => (
                <NavLink
                  key={e.to}
                  to={e.to}
                  end={e.fin}
                  onClick={cerrarMenu}
                  className={({ isActive }) => (isActive ? "activo" : "")}
                >
                  {e.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
