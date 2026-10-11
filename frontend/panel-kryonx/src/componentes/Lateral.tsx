/**
 * La navegación del Control Center.
 *
 * Tres estados con el mismo componente: expandido (icono y texto), plegado
 * (solo iconos, con el nombre como pista al pasar el puntero) y, en pantallas
 * estrechas, un cajón que se abre desde la cabecera y se cierra al navegar.
 *
 * Plegado guarda su estado: en un panel que se usa a diario, tener que
 * plegarlo en cada visita es un impuesto pequeño pero constante.
 */
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { alertasDe } from "../datos/derivados";
import { GRUPOS } from "./navegacion";
import { SelectorMarca } from "./SelectorMarca";

const CLAVE = "kryonx_lateral_plegado";

function leerPlegado(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function Lateral({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [plegado, setPlegado] = useState(leerPlegado);
  const { negocios, planes, suscripciones } = usarPlataforma();
  const { pathname } = useLocation();
  const avisos = new Set(alertasDe(negocios, planes, suscripciones).map((a) => a.negocioId)).size;

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, plegado ? "1" : "0");
    } catch {
      // Sin almacenamiento el menú recuerda su estado solo en esta pestaña.
    }
  }, [plegado]);

  // En el móvil el cajón se cierra al llegar a la página elegida.
  useEffect(() => onCerrar(), [pathname, onCerrar]);

  /** Cifras junto a la entrada: solo las que piden algo o se consultan a diario. */
  const cuentas: Record<string, { valor: number; tono?: "aviso" } | undefined> = {
    "/empresas": negocios.length
      ? avisos
        ? { valor: avisos, tono: "aviso" }
        : { valor: negocios.length }
      : undefined,
  };

  return (
    <>
      <div
        className={`lateral-velo ${abierto ? "esta-abierto" : ""}`}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <aside
        className={`lateral ${plegado ? "esta-plegado" : ""} ${abierto ? "esta-abierto" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="lateral__marca">
          <SelectorMarca plegado={plegado} />
          <button
            type="button"
            className="icono-boton lateral__cerrar"
            onClick={onCerrar}
            aria-label="Cerrar el menú"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="lateral__nav">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="lateral__grupo">
              <p className="lateral__titulo">{grupo.titulo}</p>
              {grupo.destinos.map(({ to, etiqueta, icono: Icono, exacto, pronto }) => {
                const cuenta = cuentas[to];
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={exacto}
                    className="lateral__enlace"
                    data-pista={etiqueta}
                  >
                    <Icono size={16} strokeWidth={1.8} />
                    <span className="lateral__texto">{etiqueta}</span>
                    {pronto && <span className="lateral__pronto">Pronto</span>}
                    {cuenta && (
                      <span
                        className={`lateral__cuenta ${cuenta.tono ? `lateral__cuenta--${cuenta.tono}` : ""}`}
                        title={cuenta.tono ? "Empresas con avisos" : undefined}
                      >
                        {cuenta.valor}
                      </span>
                    )}
                  </NavLink>
                );
              })}
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
          <span className="lateral__texto">Plegar menú</span>
        </button>
      </aside>
    </>
  );
}
