import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Info,
  MapPin,
  MessageSquareText,
  Phone,
  UserRound,
  XCircle,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { formatoPrecio } from "../../../utils";
import { diaRelativo } from "../../../utils/fechas";
import { formatearCantidad } from "../../../utils/cantidades";
import { EstadoPedido } from "../pedidosUi";
import { fechaHoraLarga, type Pestana } from "./CabeceraPedido";
import { aNumero, subtotalDe, totalOriginal } from "./modelo";
import { MarcasOrigen, Miniatura } from "./piezas";
import type { GestionPedido } from "./useGestionPedido";

type Nivel = "error" | "aviso" | "info";

interface Alerta {
  nivel: Nivel;
  texto: string;
  ir?: Pestana;
}

const ICONO_NIVEL: Record<Nivel, ReactNode> = {
  error: <XCircle size={16} />,
  aviso: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

export function ResumenPedido({
  g,
  soloLectura,
  onIr,
}: {
  g: GestionPedido;
  soloLectura: boolean;
  onIr: (p: Pestana) => void;
}) {
  const pedido = g.pedido!;
  const original = useMemo(() => totalOriginal(pedido), [pedido]);

  const composicion = useMemo(() => {
    let originales = 0;
    let agregados = 0;
    let personalizados = 0;
    for (const l of g.activas) {
      if (l.origen === "ADMIN") agregados += 1;
      else originales += 1;
      if (l.personalizado) personalizados += 1;
    }
    return { originales, agregados, personalizados };
  }, [g.activas]);

  const alertas = useMemo<Alerta[]>(() => {
    const lista: Alerta[] = [];
    if (g.errores.size > 0)
      lista.push({ nivel: "error", texto: `${g.errores.size} producto(s) con datos inválidos.`, ir: "productos" });
    if (Object.keys(g.erroresEntrega).length > 0)
      lista.push({ nivel: "error", texto: "Hay datos de entrega por corregir.", ir: "entrega" });
    if (g.activas.length === 0)
      lista.push({ nivel: "error", texto: "El pedido no tiene productos.", ir: "productos" });

    const sinPrecio = g.activas.filter((l) => aNumero(l.precio_unitario) === 0).length;
    if (sinPrecio > 0)
      lista.push({ nivel: "aviso", texto: `${sinPrecio} producto(s) con precio en $0.`, ir: "productos" });

    const enRevision = g.activas.filter((l) => l.estado_revision === "PENDIENTE").length;
    if (enRevision > 0)
      lista.push({
        nivel: "aviso",
        texto: `${enRevision} producto(s) escritos por el cliente esperan revisión para el catálogo.`,
        ir: "productos",
      });

    if (g.catalogoCargado && !soloLectura) {
      const fueraDeCatalogo = g.activas.filter(
        (l) =>
          !l.personalizado &&
          l.producto_id != null &&
          !g.productoPorId.get(l.producto_id)?.presentaciones.some((p) => p.id === l.presentacion_id)
      ).length;
      if (fueraDeCatalogo > 0)
        lista.push({
          nivel: "aviso",
          texto: `${fueraDeCatalogo} producto(s) ya no están activos en el catálogo.`,
          ir: "productos",
        });
    }

    if (!pedido.telefono_de_contacto)
      lista.push({ nivel: "aviso", texto: "El pedido no tiene teléfono de contacto.", ir: "entrega" });
    if (!pedido.direccion_de_entrega)
      lista.push({ nivel: "aviso", texto: "El pedido no tiene dirección de entrega.", ir: "entrega" });

    if (g.cambios.total > 0)
      lista.push({ nivel: "info", texto: `Tienes ${g.cambios.total} cambio(s) sin guardar.` });
    if (original !== null && Math.abs(original - g.total) >= 1)
      lista.push({
        nivel: "info",
        texto: `El total cambió frente a lo que pidió el cliente: ${formatoPrecio(original)} → ${formatoPrecio(g.total)}.`,
        ir: "historial",
      });
    return lista;
  }, [g, pedido, original, soloLectura]);

  const destacados = [...g.activas].sort((a, b) => subtotalDe(b) - subtotalDe(a)).slice(0, 5);
  const diferencia = original !== null ? g.total - original : null;

  return (
    <div className="gp-resumen">
      <section className="gp-kpis" aria-label="Cifras del pedido">
        <div className="gp-kpi destacado">
          <span className="gp-kpi-etiqueta">Total del pedido</span>
          <span className="gp-kpi-valor">{formatoPrecio(g.total)}</span>
          {diferencia !== null && Math.abs(diferencia) >= 1 ? (
            <span className={`gp-kpi-pie ${diferencia > 0 ? "sube" : "baja"}`}>
              {diferencia > 0 ? "+" : "−"}
              {formatoPrecio(Math.abs(diferencia))} frente al original
            </span>
          ) : (
            <span className="gp-kpi-pie">Igual a lo que pidió el cliente</span>
          )}
        </div>
        <div className="gp-kpi">
          <span className="gp-kpi-etiqueta">Productos</span>
          <span className="gp-kpi-valor">{g.activas.length}</span>
          <span className="gp-kpi-pie">
            {composicion.originales} original{composicion.originales === 1 ? "" : "es"}
            {composicion.agregados > 0 && ` · ${composicion.agregados} agregado${composicion.agregados === 1 ? "" : "s"}`}
            {composicion.personalizados > 0 && ` · ${composicion.personalizados} personalizado${composicion.personalizados === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="gp-kpi">
          <span className="gp-kpi-etiqueta">Recibido</span>
          <span className="gp-kpi-valor pequeno">{diaRelativo(pedido.fecha_pedido)}</span>
          <span className="gp-kpi-pie">{fechaHoraLarga(pedido.fecha_pedido)}</span>
        </div>
        <div className="gp-kpi">
          <span className="gp-kpi-etiqueta">Estado</span>
          <span className="gp-kpi-valor pequeno">
            <EstadoPedido estado={pedido.estado} />
          </span>
          <span className="gp-kpi-pie">
            {pedido.editado_por_nombre ? `Última edición: ${pedido.editado_por_nombre}` : "Sin ediciones del equipo"}
          </span>
        </div>
      </section>

      <div className="gp-resumen-cuerpo">
        <div className="gp-columna">
          <section className="gp-superficie">
            <header className="gp-superficie-cabecera">
              <h3>Cliente y entrega</h3>
              <button type="button" className="gp-enlace" onClick={() => onIr("entrega")}>
                Ver entrega <ArrowRight size={14} />
              </button>
            </header>
            <dl className="gp-ficha">
              <div>
                <dt>
                  <UserRound size={14} /> Cliente
                </dt>
                <dd>
                  {pedido.cliente_nombre || "—"}
                  {pedido.cliente_documento && <small>C.C./NIT {pedido.cliente_documento}</small>}
                </dd>
              </div>
              <div>
                <dt>
                  <Phone size={14} /> Teléfono
                </dt>
                <dd>
                  {pedido.telefono_de_contacto ? (
                    <a href={`tel:${pedido.telefono_de_contacto.replace(/\s/g, "")}`}>{pedido.telefono_de_contacto}</a>
                  ) : (
                    <span className="gp-tenue">Sin teléfono</span>
                  )}
                  {pedido.telefono_entrega && <small>Solo para esta entrega</small>}
                </dd>
              </div>
              <div className="ancho">
                <dt>
                  <MapPin size={14} /> Dirección
                </dt>
                <dd>
                  {pedido.direccion_de_entrega || <span className="gp-tenue">Sin dirección</span>}
                  {pedido.direccion_entrega && <small>Dirección solo para este pedido</small>}
                </dd>
              </div>
              {pedido.fecha_programada && (
                <div className="ancho">
                  <dt>Entrega programada</dt>
                  <dd>{fechaHoraLarga(pedido.fecha_programada)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="gp-superficie">
            <header className="gp-superficie-cabecera">
              <h3>
                <MessageSquareText size={15} /> Observaciones del cliente
              </h3>
            </header>
            {pedido.observaciones?.trim() ? (
              <blockquote className="gp-cita">{pedido.observaciones}</blockquote>
            ) : (
              <p className="gp-tenue gp-sin-dato">El cliente no dejó observaciones.</p>
            )}
          </section>
        </div>

        <div className="gp-columna">
          <section className="gp-superficie">
            <header className="gp-superficie-cabecera">
              <h3>Validación</h3>
            </header>
            {alertas.length === 0 ? (
              <p className="gp-alerta ok">
                <CircleCheck size={16} /> Sin inconsistencias: el pedido está listo.
              </p>
            ) : (
              <ul className="gp-alertas">
                {alertas.map((a) => (
                  <li key={a.texto} className={`gp-alerta ${a.nivel}`}>
                    {ICONO_NIVEL[a.nivel]}
                    <span>{a.texto}</span>
                    {a.ir && (
                      <button type="button" className="gp-enlace" onClick={() => onIr(a.ir!)}>
                        Revisar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="gp-superficie">
            <header className="gp-superficie-cabecera">
              <h3>Productos principales</h3>
              <button type="button" className="gp-enlace" onClick={() => onIr("productos")}>
                {soloLectura ? "Ver todos" : "Gestionar"} <ArrowRight size={14} />
              </button>
            </header>
            <ul className="gp-lista-compacta">
              {destacados.map((l) => (
                <li key={l.clave}>
                  <Miniatura
                    src={l.producto_id != null ? g.productoPorId.get(l.producto_id)?.imagen_url : null}
                    nombre={l.nombre_producto}
                  />
                  <span className="gp-lista-nombre">
                    {l.nombre_producto}
                    <small>
                      {formatearCantidad(l.cantidad || "0")} {l.unidad_nombre || ""}
                      {l.presentacion_nombre ? ` · ${l.presentacion_nombre}` : ""}
                    </small>
                  </span>
                  <MarcasOrigen linea={l} compacto />
                  <span className="gp-lista-valor">{formatoPrecio(subtotalDe(l))}</span>
                </li>
              ))}
            </ul>
            {g.activas.length > destacados.length && (
              <p className="gp-tenue gp-mas">y {g.activas.length - destacados.length} producto(s) más</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
