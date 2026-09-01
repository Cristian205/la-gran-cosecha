"use client";

import { useEnvoltorio } from "@/componentes/CapaCliente";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES, enlaceActivo } from "@/lib/navegacion";
import { useCart } from "@/estado/carrito";
import { BusquedaGlobal } from "@/componentes/BusquedaGlobal";

export function Navbar() {
  // El texto buscado y el carrito viven en la capa cliente: con el enrutado de
  // Next no hay un componente común que los sostenga entre rutas.
  const { busqueda, buscar, abrirCarrito } = useEnvoltorio();
  const totalLineas = useCart((s) => s.totalLineas());
  const { config } = useSiteConfig();
  // Igual que en el pie: el nombre es del negocio, no de la plataforma.
  const nombre = config.nombre_empresa || "la tienda";
  const pathname = usePathname();
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
  }, [pathname]);

  return (
    <nav className={`navbar ${conScroll ? "con-scroll" : ""}`}>
      <Link href="/" className="marca">
        <span className={`logo-circ ${config.logo_url ? "sin-fondo" : ""}`}>
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={nombre}
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
            />
          ) : (
            nombre.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="marca-txt">{nombre}</span>
      </Link>

      {/* En móvil los enlaces viven en la barra inferior (BottomNav). */}
      <div className="nav-links">
        {ENLACES.map((e) => (
          <Link
            key={e.to}
            href={e.to}
            className={enlaceActivo(pathname, e.to, e.fin) ? "activo" : ""}
          >
            {e.label}
          </Link>
        ))}
      </div>

      <BusquedaGlobal busqueda={busqueda} onBuscar={buscar} atajoTeclado />

      <button
        className="btn-buscar-movil"
        onClick={() => setBuscadorMovilAbierto((v) => !v)}
        aria-label={buscadorMovilAbierto ? "Cerrar búsqueda" : "Buscar"}
        aria-expanded={buscadorMovilAbierto}
      >
        {buscadorMovilAbierto ? <X size={20} /> : <Search size={20} />}
      </button>

      <button className="btn-carrito" onClick={abrirCarrito}>
        <ShoppingCart size={18} />
        <span className="btn-carrito-txt">Carrito</span>
        {totalLineas > 0 && <span className="badge">{totalLineas}</span>}
      </button>

      {buscadorMovilAbierto && (
        <div className="navbar-buscador-movil">
          <BusquedaGlobal
            busqueda={busqueda}
            onBuscar={buscar}
            onNavegar={() => setBuscadorMovilAbierto(false)}
            autoFocus
          />
        </div>
      )}
    </nav>
  );
}
