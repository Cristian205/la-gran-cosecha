/**
 * Buscar en toda la plataforma.
 *
 * Con veinte empresas se navega por el menú; con mil, el menú es un obstáculo.
 * Por eso la búsqueda es global desde el principio y se abre con teclado: es la
 * ruta corta a cualquier cosa —una empresa, un dominio, un permiso— sin pasar
 * por la lista que la contiene.
 *
 * Busca sobre los catálogos que el panel ya tiene cargados: no hay endpoint de
 * búsqueda y no se inventa uno. Cuando lo haya, lo que cambia es de dónde sale
 * `resultados`, no esta pantalla.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Globe, Layers, Search, ShieldCheck } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { ETIQUETA_ESTADO } from "../datos/derivados";

type Familia = "empresa" | "dominio" | "plan" | "permiso";

interface Resultado {
  id: string;
  familia: Familia;
  titulo: string;
  contexto: string;
  destino: string;
}

const ICONO = {
  empresa: Building2,
  dominio: Globe,
  plan: Layers,
  permiso: ShieldCheck,
} as const;

const FAMILIA = {
  empresa: "Empresa",
  dominio: "Dominio",
  plan: "Plan",
  permiso: "Permiso",
} as const;

/** Normaliza para que "Perfumeria" encuentre "Perfumería". */
function plano(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function BuscadorGlobal({ onCerrar }: { onCerrar: () => void }) {
  const { negocios, planes, permisos } = usarPlataforma();
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);
  const navegar = useNavigate();
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => entrada.current?.focus(), []);

  const todo = useMemo<Resultado[]>(() => {
    const filas: Resultado[] = [];
    for (const negocio of negocios) {
      filas.push({
        id: `e${negocio.id}`,
        familia: "empresa",
        titulo: negocio.nombre,
        contexto: `${negocio.slug} · ${ETIQUETA_ESTADO[negocio.estado]}`,
        destino: `/empresas/${negocio.id}`,
      });
      for (const dominio of negocio.dominios) {
        filas.push({
          id: `d${negocio.id}${dominio}`,
          familia: "dominio",
          titulo: dominio,
          contexto: negocio.nombre,
          destino: `/empresas/${negocio.id}/dominios`,
        });
      }
    }
    for (const plan of planes) {
      filas.push({
        id: `p${plan.id}`,
        familia: "plan",
        titulo: plan.nombre,
        contexto: `${plan.negocios} ${plan.negocios === 1 ? "empresa" : "empresas"}`,
        destino: "/planes",
      });
    }
    for (const permiso of permisos) {
      filas.push({
        id: `r${permiso.id}`,
        familia: "permiso",
        titulo: permiso.etiqueta,
        contexto: `${permiso.modulo} · ${permiso.codename}`,
        destino: "/permisos",
      });
    }
    return filas;
  }, [negocios, planes, permisos]);

  const resultados = useMemo(() => {
    const busqueda = plano(consulta.trim());
    if (!busqueda) return todo.filter((r) => r.familia === "empresa").slice(0, 8);
    return todo
      .filter((r) => plano(`${r.titulo} ${r.contexto}`).includes(busqueda))
      .slice(0, 12);
  }, [todo, consulta]);

  useEffect(() => setActivo(0), [consulta]);

  function ir(resultado: Resultado | undefined) {
    if (!resultado) return;
    navegar(resultado.destino);
    onCerrar();
  }

  function alPulsar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(resultados[activo]);
    } else if (e.key === "Escape") {
      onCerrar();
    }
  }

  return (
    <div className="velo velo--alto" onMouseDown={onCerrar}>
      <div
        className="paleta"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Crynex"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="paleta__entrada">
          <Search size={16} />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={alPulsar}
            placeholder="Buscar empresas, dominios, planes, permisos…"
            aria-label="Buscar"
          />
          <kbd>Esc</kbd>
        </div>

        {resultados.length === 0 ? (
          <p className="paleta__vacio">
            Nada coincide con «{consulta}».
          </p>
        ) : (
          <ul className="paleta__lista">
            {resultados.map((resultado, i) => {
              const Icono = ICONO[resultado.familia];
              return (
                <li key={resultado.id}>
                  <button
                    type="button"
                    className={`paleta__fila ${i === activo ? "esta-activa" : ""}`}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => ir(resultado)}
                  >
                    <Icono size={15} />
                    <span className="paleta__titulo">{resultado.titulo}</span>
                    <span className="paleta__contexto">{resultado.contexto}</span>
                    <span className="paleta__familia">{FAMILIA[resultado.familia]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="paleta__pie">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
        </footer>
      </div>
    </div>
  );
}
