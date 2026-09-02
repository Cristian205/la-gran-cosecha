"use client";

import { useEnvoltorio } from "@/componentes/CapaCliente";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid, Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES, enlaceActivo } from "@/lib/navegacion";
import { useCart } from "@/estado/carrito";
import { BusquedaGlobal } from "@/componentes/BusquedaGlobal";
import { icono } from "@/bloques/iconos";
import { claseDeVariante } from "@/bloques/Seccion";

/**
 * Un enlace del menu, tal como lo guarda la composicion del armazon.
 *
 * Antes los enlaces eran una constante de cuatro entradas en `navegacion.ts`.
 * Eso significaba que un negocio sin pagina «Nosotros» la tenia igualmente en
 * el menu, y que anadir «Mayoristas» era un despliegue.
 */
export interface EnlaceCabecera {
  texto: string;
  href: string;
  /** Solo activo en la ruta exacta. Para «/», que si no lo estaria siempre. */
  exacto?: boolean;
}

/**
 * Un aviso de la barra fina de arriba: «Envios rapidos», «100% originales».
 *
 * Es una lista y no dos campos porque el numero cambia con el negocio y con el
 * ancho de la pantalla. `lado` decide si va pegado a la izquierda o a la
 * derecha, que es la unica decision de maqueta que el dato necesita tomar.
 */
export interface AvisoCabecera {
  texto: string;
  icono?: string;
  lado?: "izquierda" | "derecha";
}

interface Props {
  enlaces?: EnlaceCabecera[];
  mostrar_buscador?: boolean;
  cta_texto?: string;
  avisos?: AvisoCabecera[];
  /** El boton que abre el catalogo, a la izquierda del buscador. Sin texto no
   *  se dibuja: es una pieza de las tiendas con muchas categorias, y una
   *  ferreteria de treinta referencias no lo quiere. */
  categorias_texto?: string;
  categorias_href?: string;
  /** Ensenar cuanto lleva el carrito, no solo cuantas lineas. */
  mostrar_total?: boolean;
  variante?: string;
}

/** Los aspectos que esta hoja de estilos sabe dibujar para la cabecera. */
const VARIANTES = ["clasica", "boutique"] as const;

/**
 * La cabecera de la tienda. Es tambien el bloque «cabecera».
 *
 * Se le anadieron propiedades en vez de escribir un componente nuevo: el CSS,
 * el buscador movil, el atajo de teclado y el cajon del carrito ya estaban
 * resueltos aqui, y duplicarlos habria dado dos cabeceras que mantener y una
 * que se queda atras.
 *
 * Sin propiedades se comporta EXACTAMENTE como antes —los enlaces de siempre,
 * el buscador puesto—, asi que las tiendas que todavia no tienen composicion de
 * armazon no notan nada.
 */
export function Navbar({
  enlaces,
  mostrar_buscador = true,
  cta_texto = "Carrito",
  avisos = [],
  categorias_texto = "",
  categorias_href = "/tienda",
  mostrar_total = false,
  variante,
}: Props = {}) {
  // El texto buscado y el carrito viven en la capa cliente: con el enrutado de
  // Next no hay un componente común que los sostenga entre rutas.
  const { busqueda, buscar, abrirCarrito } = useEnvoltorio();
  const totalLineas = useCart((s) => s.totalLineas());
  const totalPrecio = useCart((s) => s.totalPrecio());
  const { config } = useSiteConfig();
  // Igual que en el pie: el nombre es del negocio, no de la plataforma.
  const nombre = config.nombre_empresa || "la tienda";
  const pathname = usePathname();
  const [buscadorMovilAbierto, setBuscadorMovilAbierto] = useState(false);
  const [conScroll, setConScroll] = useState(false);

  // Sin enlaces configurados manda la lista de siempre: una cabecera sin menu
  // dejaria la tienda sin navegacion en escritorio, que es peor que ignorar
  // una composicion incompleta.
  const menu: EnlaceCabecera[] =
    enlaces && enlaces.length > 0
      ? enlaces
      : ENLACES.map((e) => ({ texto: e.label, href: e.to, exacto: e.fin }));

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

  const clase = claseDeVariante(variante, VARIANTES, "navbar", "clasica");
  const izquierda = avisos.filter((a) => a.lado !== "derecha");
  const derecha = avisos.filter((a) => a.lado === "derecha");

  return (
    <>
      {avisos.length > 0 && (
        // La barra fina de arriba. Solo existe si el negocio la llena: sin
        // avisos no se dibuja una franja vacia, que ocuparia alto y no diria
        // nada — el mismo criterio que el encabezado de `Seccion`.
        <div className={`navbar-avisos ${clase}-avisos`}>
          <div className="navbar-avisos-cara">
            {[izquierda, derecha].map((grupo, g) => (
              <div key={g}>
                {grupo.map((a, i) => {
                  const Icono = icono(a.icono);
                  return (
                    <span key={`${a.texto}-${i}`}>
                      <Icono size={14} aria-hidden="true" />
                      {a.texto}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

    <nav className={`navbar ${clase} ${conScroll ? "con-scroll" : ""}`}>
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

      {categorias_texto && (
        <Link className="navbar-categorias" href={categorias_href || "/tienda"}>
          <LayoutGrid size={16} aria-hidden="true" />
          <span>{categorias_texto}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </Link>
      )}

      {/* En móvil los enlaces viven en la barra inferior (BottomNav). */}
      <div className="nav-links">
        {menu.map((e) => (
          <Link
            key={`${e.href}-${e.texto}`}
            href={e.href}
            className={enlaceActivo(pathname, e.href, e.exacto) ? "activo" : ""}
          >
            {e.texto}
          </Link>
        ))}
      </div>

      {mostrar_buscador && (
        <BusquedaGlobal busqueda={busqueda} onBuscar={buscar} atajoTeclado />
      )}

      {mostrar_buscador && (
      <button
        className="btn-buscar-movil"
        onClick={() => setBuscadorMovilAbierto((v) => !v)}
        aria-label={buscadorMovilAbierto ? "Cerrar búsqueda" : "Buscar"}
        aria-expanded={buscadorMovilAbierto}
      >
        {buscadorMovilAbierto ? <X size={20} /> : <Search size={20} />}
      </button>
      )}

      <button className="btn-carrito" onClick={abrirCarrito}>
        <ShoppingCart size={18} />
        <span className="btn-carrito-txt">
          {cta_texto}
          {/* El importe solo si el negocio lo pide: en una tienda donde el
              precio depende del dia —la de abastos— ensenar un total en la
              barra invita a discutirlo antes de confirmar el pedido. */}
          {mostrar_total && totalPrecio > 0 && (
            <em>{`$${Math.round(totalPrecio).toLocaleString("es-CO")}`}</em>
          )}
        </span>
        {totalLineas > 0 && <span className="badge">{totalLineas}</span>}
      </button>

      {mostrar_buscador && buscadorMovilAbierto && (
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
    </>
  );
}
