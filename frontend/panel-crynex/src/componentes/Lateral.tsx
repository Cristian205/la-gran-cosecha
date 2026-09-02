/**
 * La navegación de Crynex.
 *
 * Agrupada por lo que el administrador viene a hacer, no por tablas: los
 * clientes por un lado, lo que se les vende por otro y la operación por otro.
 * Solo aparecen destinos que existen de verdad — una sección "Facturación" que
 * lleva a una pantalla vacía enseña a desconfiar del menú entero.
 *
 * Colapsado guarda su estado: en un panel que se usa a diario, tener que
 * plegarlo en cada visita es un impuesto pequeño pero constante.
 */
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Wand2,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Layers,
  LayoutTemplate,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

interface Destino {
  to: string;
  etiqueta: string;
  icono: LucideIcon;
  exacto?: boolean;
}

export const GRUPOS: { titulo: string; destinos: Destino[] }[] = [
  {
    titulo: "General",
    destinos: [{ to: "/", etiqueta: "Resumen", icono: LayoutGrid, exacto: true }],
  },
  {
    titulo: "Clientes",
    destinos: [{ to: "/empresas", etiqueta: "Empresas", icono: Building2 }],
  },
  {
    titulo: "Producto",
    destinos: [
      { to: "/planes", etiqueta: "Planes", icono: Layers },
      { to: "/permisos", etiqueta: "Permisos", icono: ShieldCheck },
      { to: "/plantillas", etiqueta: "Plantillas", icono: LayoutTemplate },
      { to: "/presets", etiqueta: "Presets", icono: Wand2 },
    ],
  },
  {
    titulo: "Operación",
    destinos: [{ to: "/suscripciones", etiqueta: "Suscripciones", icono: Receipt }],
  },
];

const CLAVE = "crynex_lateral_plegado";

export function Lateral() {
  const [plegado, setPlegado] = useState(
    () => localStorage.getItem(CLAVE) === "1"
  );

  useEffect(() => {
    localStorage.setItem(CLAVE, plegado ? "1" : "0");
  }, [plegado]);

  return (
    <aside className={`lateral ${plegado ? "esta-plegado" : ""}`}>
      <div className="lateral__marca">
        <span className="marca" aria-label="Crynex">
          <i className="marca__punto" aria-hidden="true" />
          <span className="marca__texto">Crynex</span>
        </span>
      </div>

      <nav className="lateral__nav">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className="lateral__grupo">
            <p className="lateral__titulo">{grupo.titulo}</p>
            {grupo.destinos.map(({ to, etiqueta, icono: Icono, exacto }) => (
              <NavLink
                key={to}
                to={to}
                end={exacto}
                className="lateral__enlace"
                data-pista={etiqueta}
              >
                <Icono size={16} strokeWidth={1.9} />
                <span className="lateral__texto">{etiqueta}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        className="lateral__plegar"
        onClick={() => setPlegado((p) => !p)}
        data-pista={plegado ? "Expandir" : "Plegar"}
        aria-label={plegado ? "Expandir el menú" : "Plegar el menú"}
      >
        {plegado ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        <span className="lateral__texto">Plegar</span>
      </button>
    </aside>
  );
}
