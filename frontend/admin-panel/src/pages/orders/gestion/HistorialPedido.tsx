import {
  ArrowRight,
  BookCheck,
  CircleDot,
  FileText,
  History,
  Lock,
  Minus,
  PackageMinus,
  PackagePlus,
  PenLine,
  RefreshCw,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { EstadoVacio } from "../../../components/gestion/Gestion";
import type { EventoPedido, FotoLineaPedido, TipoEventoPedido } from "../../../types";
import { formatoPrecio } from "../../../utils";
import { formatearCantidad } from "../../../utils/cantidades";
import { ETIQUETAS_ESTADO } from "../pedidosUi";
import { Esqueleto } from "./piezas";

type Filtro = "todo" | "productos" | "entrega" | "estado";

const GRUPO: Record<TipoEventoPedido, Filtro> = {
  RECIBIDO: "estado",
  PRODUCTO_AGREGADO: "productos",
  PRODUCTO_ELIMINADO: "productos",
  CANTIDAD: "productos",
  PRECIO: "productos",
  PRESENTACION: "productos",
  PRODUCTO_EDITADO: "productos",
  ENTREGA: "entrega",
  NOTAS: "entrega",
  ESTADO: "estado",
  FACTURA: "estado",
  CATALOGO: "productos",
};

const ESTILO: Record<TipoEventoPedido, { icono: ReactNode; tono: string }> = {
  RECIBIDO: { icono: <Store size={14} />, tono: "verde" },
  PRODUCTO_AGREGADO: { icono: <PackagePlus size={14} />, tono: "azul" },
  PRODUCTO_ELIMINADO: { icono: <PackageMinus size={14} />, tono: "rojo" },
  CANTIDAD: { icono: <PenLine size={14} />, tono: "ambar" },
  PRECIO: { icono: <Tag size={14} />, tono: "ambar" },
  PRESENTACION: { icono: <RefreshCw size={14} />, tono: "ambar" },
  PRODUCTO_EDITADO: { icono: <PenLine size={14} />, tono: "ambar" },
  ENTREGA: { icono: <Truck size={14} />, tono: "violeta" },
  NOTAS: { icono: <Lock size={14} />, tono: "neutro" },
  ESTADO: { icono: <CircleDot size={14} />, tono: "verde" },
  FACTURA: { icono: <FileText size={14} />, tono: "neutro" },
  CATALOGO: { icono: <BookCheck size={14} />, tono: "verde" },
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

function dia(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function valor(campo: string | undefined, texto: string | undefined) {
  if (texto === undefined || texto === "") return "—";
  if (campo === "precio_unitario") return formatoPrecio(texto);
  if (campo === "cantidad") return formatearCantidad(texto);
  if (campo === "fecha_programada") return new Date(texto).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  if (campo === "estado") return ETIQUETAS_ESTADO[texto] ?? texto;
  return texto;
}

function Foto({ linea }: { linea: FotoLineaPedido }) {
  return (
    <span className="gp-foto">
      <strong>{linea.producto}</strong>
      {linea.presentacion && ` · ${linea.presentacion}`} — {formatearCantidad(linea.cantidad)} {linea.unidad} ×{" "}
      {formatoPrecio(linea.precio_unitario)} = <strong>{formatoPrecio(linea.subtotal)}</strong>
      {linea.origen === "CLIENTE" && <span className="gp-marca original">Original</span>}
    </span>
  );
}

function Detalle({ e }: { e: EventoPedido }) {
  const d = e.datos;
  if (e.tipo === "RECIBIDO") {
    if (d.sin_foto)
      return (
        <p className="gp-tenue gp-pequeno">
          Pedido anterior al registro detallado: se conoce cuándo llegó, no la foto exacta de su contenido.
        </p>
      );
    return (
      <details className="gp-evento-detalle">
        <summary>
          Contenido original: {d.lineas?.length ?? 0} producto(s) · {formatoPrecio(d.total ?? 0)}
        </summary>
        <ul>
          {d.lineas?.map((l) => (
            <li key={l.detalle_id}>
              <Foto linea={l} />
            </li>
          ))}
        </ul>
        {d.direccion && <p className="gp-pequeno">Dirección: {d.direccion}</p>}
      </details>
    );
  }
  if (d.linea) return <Foto linea={d.linea} />;
  if (d.cambios)
    return (
      <ul className="gp-cambios">
        {d.cambios.map((c) => (
          <li key={c.campo}>
            <span className="gp-tenue">{c.etiqueta}:</span> <del>{valor(c.campo, c.anterior)}</del>
            <ArrowRight size={12} aria-hidden="true" /> <ins>{valor(c.campo, c.nuevo)}</ins>
          </li>
        ))}
      </ul>
    );
  if (d.anterior !== undefined || d.nuevo !== undefined) {
    const campo = e.tipo === "ESTADO" ? "estado" : d.campo;
    return (
      <p className="gp-cambio">
        <del>{valor(campo, d.anterior)}</del>
        <ArrowRight size={12} aria-hidden="true" />
        <ins>{valor(campo, d.nuevo)}</ins>
      </p>
    );
  }
  if (e.tipo === "FACTURA" && d.total) return <p className="gp-tenue gp-pequeno">Total facturado: {formatoPrecio(d.total)}</p>;
  return null;
}

export function HistorialPedido({
  eventos,
  error,
  onReintentar,
}: {
  eventos: EventoPedido[] | null;
  error: boolean;
  onReintentar: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todo");

  const grupos = useMemo(() => {
    const lista = (eventos ?? []).filter((e) => filtro === "todo" || GRUPO[e.tipo] === filtro);
    const porDia: { dia: string; eventos: EventoPedido[] }[] = [];
    for (const e of lista) {
      const d = dia(e.fecha);
      const ultimo = porDia[porDia.length - 1];
      if (ultimo?.dia === d) ultimo.eventos.push(e);
      else porDia.push({ dia: d, eventos: [e] });
    }
    return porDia;
  }, [eventos, filtro]);

  if (error)
    return (
      <EstadoVacio
        icono={<History size={22} />}
        titulo="No se pudo cargar el historial"
        texto="Revisa la conexión e inténtalo de nuevo."
        accion={
          <button type="button" className="btn secundario sm" onClick={onReintentar}>
            Reintentar
          </button>
        }
      />
    );

  if (eventos === null)
    return (
      <div className="gp-linea-tiempo" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="gp-evento">
            <Esqueleto ancho={28} alto={28} radio={999} />
            <span style={{ flex: 1, display: "grid", gap: 6 }}>
              <Esqueleto ancho="50%" />
              <Esqueleto ancho="30%" alto={11} />
            </span>
          </div>
        ))}
      </div>
    );

  const conteo = (f: Filtro) => (f === "todo" ? eventos.length : eventos.filter((e) => GRUPO[e.tipo] === f).length);

  return (
    <div className="gp-historial">
      <div className="gp-barra">
        <div className="gp-barra-titulo">
          <h3>Línea de tiempo</h3>
          <span className="gp-tenue">Del más reciente al más antiguo</span>
        </div>
        <div className="gp-chips" role="group" aria-label="Filtrar eventos">
          {(
            [
              ["todo", "Todo"],
              ["productos", "Productos"],
              ["entrega", "Entrega"],
              ["estado", "Estado y factura"],
            ] as [Filtro, string][]
          ).map(([f, etiqueta]) => (
            <button
              key={f}
              type="button"
              className={`gp-chip ${filtro === f ? "activo" : ""}`}
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
            >
              {etiqueta} <span className="gp-chip-contador">{conteo(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <EstadoVacio icono={<Minus size={22} />} titulo="Sin eventos" texto="No hay eventos de este tipo en el pedido." />
      ) : (
        <div className="gp-linea-tiempo">
          {grupos.map((g) => (
            <section key={g.dia} className="gp-dia">
              <h4 className="gp-dia-titulo">{g.dia}</h4>
              <ol>
                {g.eventos.map((e) => {
                  const estilo = ESTILO[e.tipo] ?? ESTILO.NOTAS;
                  const autor = e.usuario_nombre || (e.tipo === "RECIBIDO" ? "Cliente · tienda" : "Sistema");
                  return (
                    <li key={e.id} className="gp-evento">
                      <span className={`gp-evento-icono ${estilo.tono}`} aria-hidden="true">
                        {estilo.icono}
                      </span>
                      <div className="gp-evento-cuerpo">
                        <div className="gp-evento-linea">
                          <span className="gp-evento-titulo">{e.descripcion}</span>
                          <time className="gp-evento-hora" dateTime={e.fecha}>
                            {hora(e.fecha)}
                          </time>
                        </div>
                        <Detalle e={e} />
                        <span className="gp-evento-autor">
                          {autor}
                          {e.legado && e.tipo !== "RECIBIDO" && <span className="gp-tenue"> · registro anterior</span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
