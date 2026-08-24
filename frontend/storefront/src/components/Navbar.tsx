import { Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSiteConfig } from "../context/SiteConfigContext";
import { ENLACES } from "../navegacion";
import { useCart } from "../store/cart";
import { BusquedaGlobal } from "./BusquedaGlobal";

interface Props {
  busqueda: string;
  onBuscar: (valor: string) => void;
  onAbrirCarrito: () => void;
}

export function Navbar({ busqueda, onBuscar, onAbrirCarrito }: Props) {
  const totalLineas = useCart((s) => s.totalLineas());
  const { config } = useSiteConfig();
  const location = useLocation();
  const [buscadorMovilAbierto, setBuscadorMovilAbierto] = useState(false);
  const [conScroll, setConScroll] = useState(false);

  useEffect(() => {
    function onScroll() {
      setConScroll(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cambiar de sección desde la barra inferior debe cerrar el buscador móvil.
  useEffect(() => {
    setBuscadorMovilAbierto(false);
  }, [location.pathname]);

  return (
    <nav className={`navbar ${conScroll ? "con-scroll" : ""}`}>
      <NavLink to="/" className="marca">
        <span className={`logo-circ ${config.logo_url ? "sin-fondo" : ""}`}>
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

      {/* En móvil los enlaces viven en la barra inferior (BottomNav). */}
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
        onClick={() => setBuscadorMovilAbierto((v) => !v)}
        aria-label={buscadorMovilAbierto ? "Cerrar búsqueda" : "Buscar"}
        aria-expanded={buscadorMovilAbierto}
      >
        {buscadorMovilAbierto ? <X size={20} /> : <Search size={20} />}
      </button>

      <button className="btn-carrito" onClick={onAbrirCarrito}>
        <ShoppingCart size={18} />
        <span className="btn-carrito-txt">Carrito</span>
        {totalLineas > 0 && <span className="badge">{totalLineas}</span>}
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
    </nav>
  );
}
