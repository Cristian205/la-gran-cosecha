"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ListTree } from "lucide-react";
import { useEffect, useState } from "react";

export interface EnlacePolitica {
  slug: string;
  tituloCorto: string;
  grupo: string;
}

interface Props {
  politicas: EnlacePolitica[];
  grupos: Record<string, string>;
  activa: string;
  secciones: { id: string; titulo: string }[];
}

/**
 * La sección que se está leyendo. Se toma la última cuyo título ya pasó por
 * debajo de la cabecera fija: así el índice marca lo que se lee, no lo que
 * asoma por abajo.
 */
function useSeccionVisible(ids: string[]): string | null {
  const [visible, setVisible] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const elementos = ids
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => Boolean(e));
    if (!elementos.length) return;

    const observador = new IntersectionObserver(
      () => {
        const limite = 140;
        let actual = elementos[0].id;
        for (const e of elementos) {
          if (e.getBoundingClientRect().top - limite <= 0) actual = e.id;
        }
        setVisible(actual);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0, 1] }
    );
    elementos.forEach((e) => observador.observe(e));
    return () => observador.disconnect();
  }, [ids]);

  return visible;
}

/** Escritorio: el menú lateral con todas las políticas y el índice de la actual. */
export function NavegacionLegal({ politicas, grupos, activa, secciones }: Props) {
  const visible = useSeccionVisible(secciones.map((s) => s.id));

  return (
    <nav className="legal-nav" aria-label="Políticas">
      <Link href="/legal" className={`legal-nav-inicio ${activa === "" ? "activo" : ""}`}>
        Centro legal
      </Link>
      {Object.entries(grupos).map(([grupo, nombre]) => (
        <div key={grupo} className="legal-nav-grupo">
          <span className="legal-nav-grupo-titulo">{nombre}</span>
          <ul>
            {politicas
              .filter((p) => p.grupo === grupo)
              .map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/${p.slug}`}
                    className={`legal-nav-enlace ${p.slug === activa ? "activo" : ""}`}
                    aria-current={p.slug === activa ? "page" : undefined}
                  >
                    {p.tituloCorto}
                  </Link>
                  {p.slug === activa && secciones.length > 0 && (
                    <ul className="legal-nav-indice" aria-label="En esta página">
                      {secciones.map((s) => (
                        <li key={s.id}>
                          <a href={`#${s.id}`} className={s.id === visible ? "activo" : ""}>
                            {s.titulo}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Móvil: un selector de política y un índice plegable. Un menú lateral no cabe
 * y una fila de nueve pestañas no se lee; un `<select>` nativo es lo que el
 * pulgar ya sabe usar.
 */
export function NavegacionLegalMovil({ politicas, grupos, activa, secciones }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const visible = useSeccionVisible(secciones.map((s) => s.id));
  const actual = secciones.find((s) => s.id === visible);

  return (
    <div className="legal-movil">
      <label className="legal-movil-selector">
        <span className="sr-only">Ir a otra política</span>
        <select value={activa} onChange={(e) => router.push(e.target.value ? `/${e.target.value}` : "/legal")}>
          <option value="">Centro legal</option>
          {Object.entries(grupos).map(([grupo, nombre]) => (
            <optgroup key={grupo} label={nombre}>
              {politicas
                .filter((p) => p.grupo === grupo)
                .map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.tituloCorto}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </label>

      {secciones.length > 0 && (
        <>
          <button
            type="button"
            className="legal-movil-indice-boton"
            aria-expanded={abierto}
            aria-controls="legal-indice-movil"
            onClick={() => setAbierto((a) => !a)}
          >
            <ListTree size={16} aria-hidden="true" />
            <span>{actual?.titulo ?? "Índice"}</span>
          </button>
          {abierto && (
            <ol id="legal-indice-movil" className="legal-movil-indice">
              {secciones.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={s.id === visible ? "activo" : ""} onClick={() => setAbierto(false)}>
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
