"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, History, IdCard, Loader2, PackageX, RotateCcw } from "lucide-react";
import { historialCliente } from "@/lib/datos";
import type { HistorialCliente, ItemCarrito, PedidoHistorial } from "@/lib/tipos";
import { useEnvoltorio, useSiteConfig } from "@/componentes/CapaCliente";
import { mensajeDeConsulta } from "@/componentes/tienda/IdentificacionCedula";
import { useCart } from "@/estado/carrito";
import { soloDigitos, useClienteTienda } from "@/estado/clienteTienda";
import { formatoCantidad, formatoPrecio } from "@/lib/utiles";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** Las líneas que todavía se venden, listas para el carrito con el precio de hoy. */
function aCarrito(pedido: PedidoHistorial): ItemCarrito[] {
  return pedido.lineas
    .filter((l) => l.disponible)
    .map((l) => ({
      productoId: l.producto_id,
      productoNombre: l.producto_nombre,
      imagenUrl: l.imagen_url,
      presentacionId: l.presentacion_id,
      presentacionNombre: l.presentacion_nombre,
      precioUnitario: Number(l.precio_actual),
      cantidad: Number(l.cantidad),
      permiteFraccion: l.permite_fraccion,
      tipoCantidad: l.tipo_cantidad,
    }));
}

/**
 * "Mis pedidos": el historial de una cédula, para repetir un pedido.
 *
 * Repetir no es enviarlo tal cual: el pedido elegido se carga en el carrito
 * con los precios de HOY, y desde ahí el cliente quita lo que no quiere o
 * sigue comprando para agregar más, igual que con cualquier pedido nuevo.
 */
export function MisPedidosPage() {
  const { config } = useSiteConfig();
  const recordada = useClienteTienda((s) => s.cedula);
  const recordar = useClienteTienda((s) => s.recordar);
  const olvidar = useClienteTienda((s) => s.olvidar);

  const [cedula, setCedula] = useState("");
  const [historial, setHistorial] = useState<HistorialCliente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConsultada = useRef(false);

  async function consultar(valor: string) {
    const digitos = soloDigitos(valor);
    if (digitos.length < 5) {
      setError("Escribe tu número de cédula, sin puntos.");
      return;
    }
    setError(null);
    setCargando(true);
    try {
      const datos = await historialCliente(digitos);
      setCedula(digitos);
      setHistorial(datos);
      if (datos.existe) recordar(digitos, datos.nombre ?? null);
    } catch (e) {
      setError(mensajeDeConsulta(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (recordada && !autoConsultada.current) {
      autoConsultada.current = true;
      void consultar(recordada);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordada]);

  function cambiarCedula() {
    olvidar();
    setHistorial(null);
    setCedula("");
  }

  if (config.identificacion_clientes !== "cedula") {
    return (
      <div className="contenedor mis-pedidos-pagina">
        <div className="checkout glass">
          <h1>
            <History size={24} /> Mis pedidos
          </h1>
          <p className="ident-texto">Esta tienda todavía no tiene historial de pedidos por cédula.</p>
          <Link href="/tienda" className="btn btn-verde">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor mis-pedidos-pagina">
      <div className="checkout glass">
        <h1>
          <History size={24} /> Mis pedidos
        </h1>

        {!historial ? (
          <div className="ident">
            <label className="ident-titulo" htmlFor="mp-cedula">
              <IdCard size={18} aria-hidden="true" /> Consulta con tu cédula
            </label>
            <p className="ident-texto">
              Mira lo que nos has pedido y repite cualquier pedido: podrás quitar o agregar productos antes de enviarlo.
            </p>
            <div className="ident-fila">
              <input
                id="mp-cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void consultar(cedula);
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Número de cédula"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "mp-error" : undefined}
              />
              <button
                type="button"
                className="btn btn-verde ident-btn"
                onClick={() => void consultar(cedula)}
                disabled={cargando}
              >
                {cargando ? <Loader2 size={18} className="girando" aria-hidden="true" /> : "Ver pedidos"}
              </button>
            </div>
            {error && (
              <p className="ident-error" id="mp-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="ident-cedula">
              <span>
                <IdCard size={15} aria-hidden="true" />
                {historial.existe ? <> Hola, <b>{historial.nombre}</b></> : <> Cédula <b>{cedula}</b></>}
              </span>
              <button type="button" className="ident-cambiar" onClick={cambiarCedula}>
                {historial.existe ? "¿No eres tú?" : "Cambiar"}
              </button>
            </div>

            {historial.pedidos.length === 0 ? (
              <div className="mp-vacio">
                <p className="mp-vacio-titulo">Aún no tienes pedidos con esta cédula</p>
                <p className="ident-texto">Cuando hagas tu primer pedido, lo verás aquí para repetirlo cuando quieras.</p>
                <Link href="/tienda" className="btn btn-verde">
                  Hacer mi primer pedido <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <>
                <p className="ident-texto">
                  Elige un pedido para repetirlo. Se carga en tu carrito con los precios de hoy y ahí puedes quitar o
                  agregar productos.
                </p>
                <ul className="mp-lista">
                  {historial.pedidos.map((p) => (
                    <TarjetaPedido key={p.id} pedido={p} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaPedido({ pedido }: { pedido: PedidoHistorial }) {
  const { items: enCarrito, reemplazar, agregar } = useCart();
  const { abrirCarrito } = useEnvoltorio();
  const [preguntando, setPreguntando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const disponibles = aCarrito(pedido);
  const agotadas = pedido.lineas.length - disponibles.length;
  const totalLineas = pedido.lineas.length + pedido.personalizados.length;

  function cargar(modo: "reemplazar" | "sumar") {
    if (modo === "reemplazar") reemplazar(disponibles);
    else disponibles.forEach((i) => agregar(i));
    setPreguntando(false);
    const fuera = agotadas + pedido.personalizados.length;
    setAviso(
      fuera === 0
        ? null
        : fuera === 1
          ? "1 producto no se agregó porque ya no está disponible."
          : `${fuera} productos no se agregaron porque ya no están disponibles.`
    );
    abrirCarrito();
  }

  function pedirDeNuevo() {
    if (disponibles.length === 0) return;
    if (enCarrito.length > 0) setPreguntando(true);
    else cargar("reemplazar");
  }

  return (
    <li className="mp-pedido">
      <div className="mp-pedido-cab">
        <div>
          <p className="mp-pedido-titulo">Pedido #{pedido.id}</p>
          <p className="mp-pedido-meta">
            {FECHA.format(new Date(pedido.fecha))} · {pedido.estado}
          </p>
        </div>
        <span className="mp-pedido-total">{formatoPrecio(Number(pedido.total))}</span>
      </div>

      <details className="mp-pedido-detalle">
        <summary>
          {totalLineas} {totalLineas === 1 ? "producto" : "productos"}
        </summary>
        <ul>
          {pedido.lineas.map((l) => (
            <li key={`${l.presentacion_id}-${l.cantidad}`} className={l.disponible ? "" : "is-agotada"}>
              <span>
                {formatoCantidad(Number(l.cantidad), l.permite_fraccion)} × {l.producto_nombre}{" "}
                <small>{l.presentacion_nombre}</small>
              </span>
              {l.disponible ? (
                <span className="mp-precio-hoy">{formatoPrecio(Number(l.precio_actual) * Number(l.cantidad))}</span>
              ) : (
                <span className="mp-agotado">
                  <PackageX size={13} aria-hidden="true" /> No disponible
                </span>
              )}
            </li>
          ))}
          {pedido.personalizados.map((p, i) => (
            <li key={`p-${i}`} className="is-agotada">
              <span>
                {p.cantidad} {p.unidad || "unid."} × {p.nombre}
              </span>
              <span className="mp-agotado">Fuera de catálogo</span>
            </li>
          ))}
        </ul>
      </details>

      {preguntando ? (
        <div className="mp-pregunta" role="group" aria-label="Tu carrito ya tiene productos">
          <p>Tu carrito ya tiene productos. ¿Qué hacemos?</p>
          <div>
            <button type="button" className="btn btn-verde btn-sm" onClick={() => cargar("reemplazar")}>
              Reemplazar mi carrito
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => cargar("sumar")}>
              Sumar a mi carrito
            </button>
            <button type="button" className="ident-cambiar" onClick={() => setPreguntando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-verde btn-block mp-repetir"
          onClick={pedirDeNuevo}
          disabled={disponibles.length === 0}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {disponibles.length === 0 ? "Ningún producto sigue disponible" : "Pedir de nuevo"}
        </button>
      )}
      {aviso && (
        <p className="mp-aviso" role="status">
          {aviso}
        </p>
      )}
    </li>
  );
}
