"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useEnvoltorio } from "@/componentes/CapaCliente";
import { useCart } from "@/estado/carrito";
import {
  ENLACES,
  ICONOS_NAV,
  POR_DEFECTO_NAV,
  enlaceActivo,
  type OpcionNavMovil,
} from "@/lib/navegacion";

interface Props {
  /** Las opciones configuradas en la cabecera. Vacío: los enlaces de siempre. */
  opciones?: OpcionNavMovil[];
  /** `clasica`: la barra oscura de borde a borde. `flotante`: blanca, redondeada y separada del borde. */
  estilo?: string;
  /** El negocio identifica a sus clientes: la opción «cuenta» tiene sentido. */
  conCuenta?: boolean;
  /** El buscador móvil está abierto (la opción «buscar» se ve activa). */
  buscando?: boolean;
  onBuscar?: () => void;
}

interface Item {
  clave: string;
  texto: string;
  Icono: LucideIcon;
  activo: boolean;
  href?: string;
  accion?: () => void;
  contador?: number;
}

/**
 * Navegación principal en móvil, fija al borde inferior (patrón de app: las
 * secciones quedan al alcance del pulgar en vez de escondidas tras un menú
 * hamburguesa). En escritorio no se renderiza: ahí manda la barra superior.
 *
 * Las opciones salen de la cabecera (`nav_movil`), en el orden del panel, y la
 * barra se reparte el ancho entre las que queden: una opción «cuenta» en una
 * tienda que no identifica clientes se cae sola y las demás se ensanchan. Sin
 * opciones configuradas pinta los enlaces de siempre, así que las tiendas que
 * no la tocaron no notan nada.
 */
export function BottomNav({ opciones = [], estilo = "clasica", conCuenta = false, buscando = false, onBuscar }: Props) {
  const pathname = usePathname();
  const { abrirCarrito } = useEnvoltorio();
  const lineas = useCart((s) => s.totalLineas());

  const items: Item[] =
    opciones.length === 0
      ? ENLACES.map(({ to, labelCorto, icono, fin }) => ({
          clave: to,
          texto: labelCorto,
          Icono: icono,
          href: to,
          activo: enlaceActivo(pathname, to, fin),
        }))
      : opciones.flatMap((o, i): Item[] => {
          const base = POR_DEFECTO_NAV[o.tipo];
          if (!base) return [];
          if (o.tipo === "cuenta" && !conCuenta) return [];
          if (o.tipo === "buscar" && !onBuscar) return [];
          const texto = o.texto?.trim() || base.texto;
          const Icono = ICONOS_NAV[o.icono ?? ""] ?? ICONOS_NAV[base.icono];
          const href = o.href?.trim() || base.href;
          const clave = `${o.tipo}-${i}`;
          if (o.tipo === "buscar") return [{ clave, texto, Icono, activo: buscando, accion: onBuscar }];
          if (o.tipo === "pedido") return [{ clave, texto, Icono, activo: false, accion: abrirCarrito, contador: lineas }];
          if (!href) return [];
          // Mientras el buscador está abierto, lo activo es «Buscar».
          return [{ clave, texto, Icono, href, activo: !buscando && enlaceActivo(pathname, href, href === "/") }];
        });

  if (items.length === 0) return null;

  return (
    <nav
      className={`nav-inferior ${estilo === "flotante" ? "nav-inferior--flotante" : ""}`}
      aria-label="Navegación principal"
    >
      {items.map((item) => {
        const contenido = (
          <>
            <span className="nav-inferior-icono">
              <item.Icono size={21} strokeWidth={1.9} aria-hidden="true" />
              {item.contador ? (
                <span className="nav-inferior-contador" key={item.contador}>
                  {item.contador}
                </span>
              ) : null}
            </span>
            <span className="nav-inferior-txt">{item.texto}</span>
          </>
        );
        const clase = `nav-inferior-item ${item.activo ? "activo" : ""}`;
        return item.href ? (
          <Link key={item.clave} href={item.href} className={clase} aria-current={item.activo ? "page" : undefined}>
            {contenido}
          </Link>
        ) : (
          <button
            key={item.clave}
            type="button"
            className={clase}
            onClick={item.accion}
            aria-pressed={item.accion === onBuscar ? item.activo : undefined}
            aria-label={item.contador ? `${item.texto}: ${item.contador} ${item.contador === 1 ? "producto" : "productos"}` : undefined}
          >
            {contenido}
          </button>
        );
      })}
    </nav>
  );
}
