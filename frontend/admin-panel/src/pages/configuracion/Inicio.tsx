import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, ImagePlus, Paintbrush, Search, Workflow, X } from "lucide-react";
import { obtenerModulos } from "../../api/negocio";
import { obtenerConfiguracion } from "../../api/whatsapp";
import { urlTienda } from "./diseno";
import { normalizar, type CategoriaConfig } from "./registro";
import { Estado, type TipoEstado } from "./ui";

type Resumen = Partial<Record<string, { tipo: TipoEstado; texto: string }>>;

/**
 * La portada del centro: buscar un ajuste por su nombre, o entrar por
 * categoría. Nada de formularios aquí — cada uno vive en su vista.
 */
export function InicioConfiguracion({ categorias, onIr }: { categorias: CategoriaConfig[]; onIr: (clave: string) => void }) {
  const [consulta, setConsulta] = useState("");
  const [resumen, setResumen] = useState<Resumen>({});
  const tienda = urlTienda();

  // El estado de cada categoría, para saber de un vistazo qué falta. Si algo
  // no se puede leer (permisos, red), esa tarjeta simplemente no lo muestra.
  useEffect(() => {
    let vivo = true;
    obtenerModulos()
      .then((m) => {
        if (!vivo) return;
        const activos = m.filter((x) => x.disponible && x.activo).length;
        setResumen((r) => ({ ...r, negocio: { tipo: "activo", texto: `${activos} ${activos === 1 ? "módulo activo" : "módulos activos"}` } }));
      })
      .catch(() => {});
    obtenerConfiguracion()
      .then((c) => {
        if (!vivo) return;
        const reglas = c.eventos.filter((e) => !c.eventos_apagados.includes(e.codigo)).length;
        setResumen((r) => ({
          ...r,
          automatizaciones: c.activo
            ? { tipo: "activo", texto: `${reglas} de ${c.eventos.length} reglas encendidas` }
            : { tipo: "neutro", texto: "En pausa" },
          integraciones: c.activo ? { tipo: "activo", texto: "WhatsApp encendido" } : { tipo: "inactivo", texto: "WhatsApp apagado" },
        }));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const resultados = useMemo(() => {
    const q = normalizar(consulta.trim());
    if (!q) return [];
    const terminos = q.split(/\s+/);
    return categorias.flatMap((c) =>
      c.items
        .filter((i) => {
          const texto = normalizar(`${i.titulo} ${i.descripcion} ${i.palabras} ${c.titulo}`);
          return terminos.every((t) => texto.includes(t));
        })
        .map((i) => ({ ...i, categoria: c.titulo }))
    );
  }, [consulta, categorias]);

  const puede = (clave: string) => categorias.some((c) => c.items.some((i) => i.clave === clave));

  return (
    <div className="cfg-inicio">
      <div className="cfg-buscador">
        <Search size={17} aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar un ajuste: logo, colores, WhatsApp, factura…"
          aria-label="Buscar en la configuración"
          aria-controls="cfg-resultados"
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultados[0]) onIr(resultados[0].clave);
            if (e.key === "Escape") setConsulta("");
          }}
        />
        {consulta && (
          <button type="button" className="cfg-buscador-limpiar" aria-label="Limpiar búsqueda" onClick={() => setConsulta("")}>
            <X size={15} />
          </button>
        )}
      </div>

      {consulta.trim() ? (
        <div id="cfg-resultados" className="cfg-resultados" aria-live="polite">
          {resultados.length === 0 ? (
            <p className="cfg-vacio">Nada coincide con «{consulta}». Prueba con otra palabra.</p>
          ) : (
            <ul>
              {resultados.map((r) => {
                const Icono = r.icono;
                return (
                  <li key={r.clave}>
                    <button type="button" onClick={() => onIr(r.clave)}>
                      <span className="cfg-resultado-icono">
                        <Icono size={16} aria-hidden />
                      </span>
                      <span className="cfg-resultado-texto">
                        <strong>{r.titulo}</strong>
                        <span>
                          {r.categoria} · {r.descripcion}
                        </span>
                      </span>
                      <ArrowRight size={15} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="cfg-rapidos" aria-label="Accesos rápidos">
            {puede("negocio/identidad") && (
              <button type="button" onClick={() => onIr("negocio/identidad")}>
                <ImagePlus size={15} aria-hidden /> Cambiar logo y nombre
              </button>
            )}
            {puede("diseno/apariencia") && (
              <button type="button" onClick={() => onIr("diseno/apariencia")}>
                <Paintbrush size={15} aria-hidden /> Colores de la tienda
              </button>
            )}
            {puede("automatizaciones/reglas") && (
              <button type="button" onClick={() => onIr("automatizaciones/reglas")}>
                <Workflow size={15} aria-hidden /> Avisos automáticos
              </button>
            )}
            {puede("diseno/plantillas") && (
              <Link to="/tienda">
                <Paintbrush size={15} aria-hidden /> Editor visual
              </Link>
            )}
            {tienda && (
              <a href={tienda} target="_blank" rel="noreferrer">
                <ExternalLink size={15} aria-hidden /> Ver mi tienda
              </a>
            )}
          </div>

          <div className="cfg-categorias">
            {categorias.map((c) => {
              const Icono = c.icono;
              const estado = resumen[c.clave];
              return (
                <section key={c.clave} className="cfg-categoria" aria-labelledby={`cat-${c.clave}`}>
                  <button type="button" className="cfg-categoria-cabecera" onClick={() => onIr(c.items[0].clave)}>
                    <span className="cfg-categoria-icono">
                      <Icono size={18} aria-hidden />
                    </span>
                    <span className="cfg-categoria-texto">
                      <strong id={`cat-${c.clave}`}>{c.titulo}</strong>
                      <span>{c.descripcion}</span>
                    </span>
                  </button>
                  {estado && (
                    <div className="cfg-categoria-estado">
                      <Estado tipo={estado.tipo}>{estado.texto}</Estado>
                    </div>
                  )}
                  <ul className="cfg-categoria-items">
                    {c.items.map((i) => (
                      <li key={i.clave}>
                        <button type="button" onClick={() => onIr(i.clave)}>
                          {i.titulo}
                          <ArrowRight size={13} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
