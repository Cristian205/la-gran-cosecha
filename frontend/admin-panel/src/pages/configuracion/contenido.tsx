import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  cambiarContenido,
  eliminarAnuncio,
  eliminarBanner,
  eliminarBeneficio,
  eliminarOferta,
  eliminarTestimonio,
  obtenerAnuncios,
  obtenerBanners,
  obtenerBeneficios,
  obtenerOfertas,
  obtenerTestimonios,
  type RecursoContenido,
} from "../../api/content";
import { Tooltip } from "../../components/Tooltip";
import type { Anuncio, BeneficioComercial, OfertaProducto, PromoBanner, Testimonio } from "../../types";
import { extraerMensajeError, formatoPrecio } from "../../utils";
import { alertaError, alertaExito, confirmarEliminar } from "../../utils/alertas";
import { AnuncioFormModal } from "../content/AnuncioFormModal";
import { BannerFormModal } from "../content/BannerFormModal";
import { BeneficioFormModal } from "../content/BeneficioFormModal";
import { OfertaFormModal } from "../content/OfertaFormModal";
import { TestimonioFormModal } from "../content/TestimonioFormModal";
import { estadoDeVigencia } from "../content/Vigencia";
import { urlTienda } from "./diseno";
import { CabeceraVista, Cargando, ErrorCarga, Estado, Interruptor } from "./ui";

interface ElementoBase {
  id: number;
  activo: boolean;
  orden?: number;
}

interface ConfigLista<T extends ElementoBase> {
  clave: string;
  titulo: string;
  descripcion: string;
  singular: string;
  /** Para concordar: «Nueva oferta», «activada». */
  femenino?: boolean;
  recurso: RecursoContenido;
  obtener: () => Promise<T[]>;
  eliminar: (id: number) => Promise<void>;
  /** El orden manda en la tienda (el modelo tiene `orden`). */
  ordenable: boolean;
  imagen: (x: T) => string | null | undefined;
  nombre: (x: T) => string;
  detalle: (x: T) => ReactNode;
  vigencia?: (x: T) => "programado" | "vencido" | null;
  formulario: (x: T | null, cerrar: () => void, guardado: () => void) => ReactNode;
}

/**
 * Un listado de contenido de la tienda: activar, ordenar, editar, eliminar y
 * ver en la tienda, sin abrir el formulario para lo que es un solo clic.
 *
 * El formulario de cada tipo es el de siempre: aquí solo cambia el listado.
 */
function ListaContenido<T extends ElementoBase>({ cfg }: { cfg: ConfigLista<T> }) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ item: T | null } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const tienda = urlTienda();
  const o = cfg.femenino ? "a" : "o";
  const nuevo = `${cfg.femenino ? "Nueva" : "Nuevo"} ${cfg.singular.toLowerCase()}`;

  const cargar = useCallback(() => {
    setError(null);
    cfg
      .obtener()
      .then((lista) =>
        setItems(cfg.ordenable ? [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id) : lista)
      )
      .catch((e) => setError(extraerMensajeError(e, `No se pudieron cargar los ${cfg.titulo.toLowerCase()}.`)));
  }, [cfg]);

  useEffect(cargar, [cargar]);

  async function alternar(x: T, activo: boolean) {
    setOcupado(x.id);
    setItems((l) => l?.map((y) => (y.id === x.id ? { ...y, activo } : y)) ?? l);
    try {
      await cambiarContenido(cfg.recurso, x.id, { activo });
      alertaExito(`${cfg.singular} ${activo ? "activad" : "desactivad"}${o}`);
    } catch (e) {
      setItems((l) => l?.map((y) => (y.id === x.id ? { ...y, activo: !activo } : y)) ?? l);
      alertaError(extraerMensajeError(e, "No se pudo cambiar el estado."));
    } finally {
      setOcupado(null);
    }
  }

  async function mover(indice: number, delta: -1 | 1) {
    if (!items) return;
    const destino = indice + delta;
    if (destino < 0 || destino >= items.length) return;
    const anterior = items;
    const nueva = [...items];
    [nueva[indice], nueva[destino]] = [nueva[destino], nueva[indice]];
    // Se renumera la lista entera (0, 1, 2…): con órdenes repetidos —todos en
    // 0, lo habitual— intercambiar dos valores no movería nada.
    const renumerada = nueva.map((x, i) => ({ ...x, orden: i }));
    setItems(renumerada);
    setOcupado(nueva[destino].id);
    try {
      await Promise.all(
        renumerada
          .filter((x) => anterior.find((y) => y.id === x.id)?.orden !== x.orden)
          .map((x) => cambiarContenido(cfg.recurso, x.id, { orden: x.orden }))
      );
    } catch (e) {
      setItems(anterior);
      alertaError(extraerMensajeError(e, "No se pudo cambiar el orden."));
      cargar();
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(x: T) {
    if (!(await confirmarEliminar(`¿Eliminar «${cfg.nombre(x)}»?`, "No se puede deshacer."))) return;
    try {
      await cfg.eliminar(x.id);
      setItems((l) => l?.filter((y) => y.id !== x.id) ?? l);
      alertaExito(`${cfg.singular} eliminad${o}`);
    } catch (e) {
      alertaError(extraerMensajeError(e, "No se pudo eliminar."));
    }
  }

  const activos = items?.filter((x) => x.activo).length ?? 0;

  return (
    <div className="cfg-vista">
      <CabeceraVista
        titulo={cfg.titulo}
        descripcion={cfg.descripcion}
        acciones={
          <>
            {tienda && (
              <a className="btn secundario sm cfg-btn-icono" href={tienda} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden /> Ver en la tienda
              </a>
            )}
            <button type="button" className="btn primario sm cfg-btn-icono" onClick={() => setEditando({ item: null })}>
              <Plus size={14} aria-hidden /> {nuevo}
            </button>
          </>
        }
      />
      {error ? (
        <ErrorCarga mensaje={error} onReintentar={cargar} />
      ) : !items ? (
        <Cargando />
      ) : items.length === 0 ? (
        <div className="cfg-vacio-grande">
          <strong>Aún no hay {cfg.titulo.toLowerCase()}</strong>
          <span>{cfg.femenino ? "Crea la primera: aparecerá" : "Crea el primero: aparecerá"} en la tienda en cuanto {cfg.femenino ? "la" : "lo"} actives.</span>
          <button type="button" className="btn primario sm cfg-btn-icono" onClick={() => setEditando({ item: null })}>
            <Plus size={14} aria-hidden /> {nuevo}
          </button>
        </div>
      ) : (
        <>
          <p className="cfg-conteo">
            {activos} de {items.length} {activos === 1 ? "visible" : "visibles"} en la tienda
            {cfg.ordenable && " · el orden de la lista es el de la tienda"}
          </p>
          <ul className="cfg-lista">
            {items.map((x, i) => {
              const vig = cfg.vigencia?.(x) ?? null;
              const img = cfg.imagen(x);
              return (
                <li key={x.id} className={`cfg-item ${x.activo ? "" : "apagado"}`}>
                  {cfg.ordenable && (
                    <div className="cfg-item-orden">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0 || ocupado !== null} aria-label={`Subir ${cfg.nombre(x)}`}>
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(i, 1)}
                        disabled={i === items.length - 1 || ocupado !== null}
                        aria-label={`Bajar ${cfg.nombre(x)}`}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  )}
                  <span className="cfg-item-imagen">{img ? <img src={img} alt="" loading="lazy" /> : <ImageOff size={16} aria-hidden />}</span>
                  <div className="cfg-item-texto">
                    <strong>{cfg.nombre(x) || <em>Sin título</em>}</strong>
                    <span>{cfg.detalle(x)}</span>
                  </div>
                  <div className="cfg-item-estado">
                    {!x.activo ? (
                      <Estado tipo="inactivo">Oculto</Estado>
                    ) : vig === "programado" ? (
                      <Estado tipo="aviso">Programado</Estado>
                    ) : vig === "vencido" ? (
                      <Estado tipo="aviso">Vencido</Estado>
                    ) : (
                      <Estado tipo="activo">Visible</Estado>
                    )}
                  </div>
                  <Interruptor
                    etiqueta={`${x.activo ? "Ocultar" : "Mostrar"} ${cfg.nombre(x)}`}
                    activo={x.activo}
                    deshabilitado={ocupado !== null}
                    onCambiar={(v) => alternar(x, v)}
                  />
                  <div className="acciones">
                    <Tooltip label="Editar">
                      <button type="button" className="btn-icon editar" onClick={() => setEditando({ item: x })} aria-label={`Editar ${cfg.nombre(x)}`}>
                        <Pencil size={15} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Eliminar">
                      <button type="button" className="btn-icon peligro" onClick={() => eliminar(x)} aria-label={`Eliminar ${cfg.nombre(x)}`}>
                        <Trash2 size={15} />
                      </button>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editando &&
        cfg.formulario(
          editando.item,
          () => setEditando(null),
          () => {
            setEditando(null);
            cargar();
            alertaExito("Guardado");
          }
        )}
    </div>
  );
}

// Las configuraciones se declaran fuera del render: `cargar` depende de `cfg`
// y un objeto nuevo en cada render repetiría la petición sin fin.
const BANNERS: ConfigLista<PromoBanner> = {
  clave: "banners",
  titulo: "Banners",
  descripcion: "El carrusel principal del inicio de la tienda.",
  singular: "Banner",
  recurso: "banners",
  obtener: obtenerBanners,
  eliminar: eliminarBanner,
  ordenable: true,
  imagen: (b) => b.imagen_url,
  nombre: (b) => b.titulo,
  detalle: (b) => b.cta_texto || b.etiqueta || "Sin botón",
  vigencia: (b) => estadoDeVigencia(b.fecha_inicio, b.fecha_fin),
  formulario: (b, cerrar, guardado) => <BannerFormModal banner={b} onCerrar={cerrar} onGuardado={guardado} />,
};

const ANUNCIOS: ConfigLista<Anuncio> = {
  clave: "anuncios",
  titulo: "Anuncios",
  descripcion: "Las piezas promocionales del cuerpo del inicio.",
  singular: "Anuncio",
  recurso: "anuncios",
  obtener: obtenerAnuncios,
  eliminar: eliminarAnuncio,
  ordenable: true,
  imagen: (a) => a.imagen_url,
  nombre: (a) => a.titulo,
  detalle: (a) => a.cta_texto || a.etiqueta || "Sin botón",
  vigencia: (a) => estadoDeVigencia(a.fecha_inicio, a.fecha_fin),
  formulario: (a, cerrar, guardado) => <AnuncioFormModal anuncio={a} onCerrar={cerrar} onGuardado={guardado} />,
};

const BENEFICIOS: ConfigLista<BeneficioComercial> = {
  clave: "beneficios",
  titulo: "Beneficios",
  descripcion: "Las razones para comprarte: envíos, horarios, garantías.",
  singular: "Beneficio",
  recurso: "beneficios",
  obtener: obtenerBeneficios,
  eliminar: eliminarBeneficio,
  ordenable: true,
  imagen: (b) => b.imagen_url,
  nombre: (b) => b.titulo,
  detalle: (b) => b.texto,
  formulario: (b, cerrar, guardado) => <BeneficioFormModal beneficio={b} onCerrar={cerrar} onGuardado={guardado} />,
};

const TESTIMONIOS: ConfigLista<Testimonio> = {
  clave: "testimonios",
  titulo: "Testimonios",
  descripcion: "Lo que dicen tus clientes, en el inicio de la tienda.",
  singular: "Testimonio",
  recurso: "testimonials",
  obtener: obtenerTestimonios,
  eliminar: eliminarTestimonio,
  ordenable: true,
  imagen: (t) => t.foto_url,
  nombre: (t) => t.nombre,
  detalle: (t) => `${"★".repeat(Math.max(0, Math.min(5, t.estrellas)))} ${t.rol ? `· ${t.rol}` : ""}`,
  formulario: (t, cerrar, guardado) => <TestimonioFormModal testimonio={t} onCerrar={cerrar} onGuardado={guardado} />,
};

const OFERTAS: ConfigLista<OfertaProducto> = {
  clave: "ofertas",
  titulo: "Ofertas",
  descripcion: "Precios especiales por presentación, con fecha de fin opcional.",
  singular: "Oferta",
  femenino: true,
  recurso: "ofertas",
  obtener: obtenerOfertas,
  eliminar: eliminarOferta,
  ordenable: false,
  imagen: (o) => o.producto_imagen_url,
  nombre: (o) => `${o.producto_nombre} · ${o.presentacion_detalle?.nombre_presentacion ?? ""}`,
  detalle: (o) =>
    `${formatoPrecio(o.precio_oferta)} (antes ${formatoPrecio(o.precio_normal)}, −${o.porcentaje_ahorro}%)${
      o.fecha_fin ? ` · hasta ${new Date(o.fecha_fin).toLocaleDateString("es-CO")}` : ""
    }`,
  vigencia: (o) => estadoDeVigencia(null, o.fecha_fin),
  formulario: (o, cerrar, guardado) => <OfertaFormModal oferta={o} onCerrar={cerrar} onGuardado={guardado} />,
};

export const BannersVista = () => <ListaContenido cfg={BANNERS} />;
export const AnunciosVista = () => <ListaContenido cfg={ANUNCIOS} />;
export const BeneficiosVista = () => <ListaContenido cfg={BENEFICIOS} />;
export const TestimoniosVista = () => <ListaContenido cfg={TESTIMONIOS} />;
export const OfertasVista = () => <ListaContenido cfg={OFERTAS} />;

/** Una vista heredada (páginas, confianza, archivos) con la cabecera del centro. */
export function VistaEnvuelta({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <div className="cfg-vista">
      <CabeceraVista titulo={titulo} descripcion={descripcion} />
      <div className="cfg-heredada">{children}</div>
    </div>
  );
}
