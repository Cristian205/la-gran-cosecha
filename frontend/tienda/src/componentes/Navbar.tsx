"use client";

import { useEnvoltorio } from "@/componentes/CapaCliente";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid, Search, ShoppingBag, ShoppingCart, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { ENLACES, enlaceActivo, tiendaConCuenta, type OpcionNavMovil } from "@/lib/navegacion";
import { BottomNav } from "@/componentes/BottomNav";
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
  /** Un botón de compra junto al carrito, solo en escritorio: en móvil la barra
   *  inferior ya lleva a la tienda y un segundo botón robaría ancho al logo. */
  boton_texto?: string;
  boton_href?: string;
  avisos?: AvisoCabecera[];
  /** El boton que abre el catalogo, a la izquierda del buscador. Sin texto no
   *  se dibuja: es una pieza de las tiendas con muchas categorias, y una
   *  ferreteria de treinta referencias no lo quiere. */
  categorias_texto?: string;
  categorias_href?: string;
  /** Ensenar cuanto lleva el carrito, no solo cuantas lineas. */
  mostrar_total?: boolean;
  /** La franja de arriba (avisos y, en `comercio`, los enlaces informativos). */
  mostrar_avisos?: boolean;
  /** «automatico»: «Mi cuenta» aparece solo si el negocio identifica a sus
   *  clientes. «oculta»: nunca. Sin valor: automático en `comercio`, oculta en
   *  las demás (que no la tenían y no deben cambiar de aspecto solas). */
  cuenta_modo?: "automatico" | "oculta";
  cuenta_texto?: string;
  cuenta_href?: string;
  /** Las opciones de la barra inferior del móvil, en orden. Vacío: las de siempre. */
  nav_movil?: OpcionNavMovil[];
  /** `clasica` (oscura, de borde a borde) o `flotante` (blanca y redondeada). */
  nav_movil_estilo?: string;
  variante?: string;
}

/** Los aspectos que esta hoja de estilos sabe dibujar para la cabecera. */
const VARIANTES = ["clasica", "boutique", "comercio"] as const;

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
  boton_texto = "",
  boton_href = "/tienda",
  avisos = [],
  categorias_texto = "",
  categorias_href = "/tienda",
  mostrar_total = false,
  mostrar_avisos = true,
  cuenta_modo,
  cuenta_texto = "Mi cuenta",
  cuenta_href = "/tienda/mis-pedidos",
  nav_movil = [],
  nav_movil_estilo = "clasica",
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
  const comercio = clase === "navbar--comercio";
  const izquierda = avisos.filter((a) => a.lado !== "derecha");
  const derecha = avisos.filter((a) => a.lado === "derecha");

  // «Mi cuenta» depende de cómo identifica el negocio a sus clientes, no de
  // una casilla visual: con «solo nombre» no hay pedidos que consultar.
  const conCuenta =
    (cuenta_modo ?? (comercio ? "automatico" : "oculta")) === "automatico" &&
    tiendaConCuenta(config.identificacion_clientes);

  const conFranja = mostrar_avisos && avisos.length > 0;

  // El botón de compra no repite un destino que el menú ya tiene: «Tienda» en
  // los enlaces y «Comprar» al lado llevando al mismo sitio son dos puertas a
  // la misma habitación, y quien entra por primera vez duda cuál usar.
  const destinoBoton = boton_href || "/tienda";
  const conBoton = Boolean(boton_texto) && !menu.some((e) => e.href === destinoBoton);

  // Lo que ya está en la barra inferior no se repite arriba en el móvil.
  const enNavMovil = (tipo: string) => nav_movil.some((o) => o.tipo === tipo);

  return (
    <>
      {conFranja && (
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

    <nav
      className={[
        "navbar",
        clase,
        conScroll ? "con-scroll" : "",
        enNavMovil("buscar") ? "navbar--buscar-abajo" : "",
        enNavMovil("pedido") ? "navbar--pedido-abajo" : "",
        enNavMovil("cuenta") ? "navbar--cuenta-abajo" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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

      {conBoton && (
        <Link className="navbar-comprar" href={destinoBoton}>
          {boton_texto}
        </Link>
      )}

      {conCuenta && (
        <Link
          className={`navbar-cuenta ${enlaceActivo(pathname, cuenta_href || "/tienda/mis-pedidos") ? "activo" : ""}`}
          href={cuenta_href || "/tienda/mis-pedidos"}
        >
          <UserRound size={18} aria-hidden="true" />
          <span>{cuenta_texto}</span>
        </Link>
      )}

      <button
        className="btn-carrito"
        onClick={abrirCarrito}
        // En el móvil el texto se oculta y queda solo el icono: el nombre va
        // aquí para que el lector de pantalla no anuncie un botón sin nombre.
        aria-label={
          totalLineas > 0
            ? `${cta_texto}: ${totalLineas} ${totalLineas === 1 ? "producto" : "productos"}`
            : cta_texto
        }
      >
        {comercio ? <ShoppingBag size={18} aria-hidden="true" /> : <ShoppingCart size={18} />}
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

      {/* Fuera del <nav>: su `backdrop-filter` haría de la barra el marco de
          cualquier hijo `fixed`, y la barra inferior se pegaría a la cabecera. */}
      <BottomNav
        opciones={nav_movil}
        estilo={nav_movil_estilo}
        conCuenta={conCuenta}
        buscando={buscadorMovilAbierto}
        onBuscar={mostrar_buscador ? () => setBuscadorMovilAbierto((v) => !v) : undefined}
      />
    </>
  );
}
