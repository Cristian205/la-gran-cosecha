"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Lock } from "lucide-react";
import { useState } from "react";
import { crearPedido, type DatosCliente } from "@/lib/datos";
import type { ClienteConsultado } from "@/lib/tipos";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { IdentificacionCedula } from "@/componentes/tienda/IdentificacionCedula";
import { useCart } from "@/estado/carrito";
import { useClienteTienda } from "@/estado/clienteTienda";
import { useUltimoPedido } from "@/estado/ultimoPedido";
import { formatoCantidad, formatoPrecio, whatsappHref } from "@/lib/utiles";

/** Códigos de país del selector de teléfono. Colombia primero y por
 *  defecto: es donde opera el negocio; el resto cubre proveedores o
 *  sucursales fuera del país sin obligarlos a escribir el código a mano. */
const CODIGOS_PAIS = [
  { valor: "+57", etiqueta: "🇨🇴 +57" },
  { valor: "+1", etiqueta: "🇺🇸 +1" },
  { valor: "+52", etiqueta: "🇲🇽 +52" },
  { valor: "+51", etiqueta: "🇵🇪 +51" },
  { valor: "+593", etiqueta: "🇪🇨 +593" },
  { valor: "+58", etiqueta: "🇻🇪 +58" },
];

const NOTA_ACUERDO_PRECIOS =
  "El cliente confirma que los precios son estimados y acepta que se ajusten " +
  "según la cotización del día de la cosecha al procesarse en el sistema.";

/** El primer mensaje que el servidor dio para los datos del cliente, si dio uno. */
function mensajeDelServidor(error: unknown): string | null {
  const detalle = (error as { detalle?: { cliente?: Record<string, unknown> } })?.detalle;
  for (const valor of Object.values(detalle?.cliente ?? {})) {
    if (Array.isArray(valor) && typeof valor[0] === "string") return valor[0];
    if (typeof valor === "string") return valor;
  }
  return null;
}

export function CheckoutPage() {
  const { items, personalizados, vaciar, totalPrecio, totalLineas } = useCart();
  const router = useRouter();
  const { config } = useSiteConfig();
  const porCedula = config.identificacion_clientes === "cedula";
  const recordarCliente = useClienteTienda((s) => s.recordar);

  const [nombre, setNombre] = useState("");
  const [codigoPais, setCodigoPais] = useState(CODIGOS_PAIS[0].valor);
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoOk, setPedidoOk] = useState<{ id: number; total: number; nombre: string } | null>(null);

  // Solo en modo cédula.
  const [cedula, setCedula] = useState("");
  const [consulta, setConsulta] = useState<ClienteConsultado | null>(null);
  const [otraDireccion, setOtraDireccion] = useState(false);
  const [direccionEntrega, setDireccionEntrega] = useState("");

  // Cliente conocido: ya dio sus datos y aceptó el acuerdo en su primer pedido.
  const conocido = porCedula && consulta !== null && consulta.existe && !consulta.requiere_datos;
  // Los campos de contacto y el acuerdo: siempre por nombre; por cédula, solo
  // la primera vez y después de que la cédula se haya consultado.
  const pideDatos = porCedula ? consulta !== null && !conocido : true;
  const listoParaEnviar = !enviando && (porCedula ? consulta !== null : true) && (!pideDatos || acepta);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (porCedula && consulta === null) {
      setError("Escribe tu cédula y pulsa Continuar.");
      return;
    }
    if (pideDatos) {
      if (!nombre.trim()) {
        setError("Por favor escribe tu nombre o el de tu negocio.");
        return;
      }
      if (!telefono.trim()) {
        setError("Por favor escribe un teléfono de contacto.");
        return;
      }
      if (!direccion.trim()) {
        setError("Por favor escribe la dirección de entrega.");
        return;
      }
      if (!acepta) {
        setError("Confirma que entiendes que los precios pueden ajustarse antes de continuar.");
        return;
      }
    }
    if (conocido && otraDireccion && !direccionEntrega.trim()) {
      setError("Escribe la dirección de entrega para este pedido.");
      return;
    }
    if (items.length === 0 && personalizados.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }

    const datosContacto: DatosCliente = pideDatos
      ? { nombre: nombre.trim(), telefono: `${codigoPais} ${telefono.trim()}`, direccion: direccion.trim() }
      : {};
    const cliente: DatosCliente = porCedula
      ? {
          ...datosContacto,
          cedula,
          acepta_precios: pideDatos ? acepta : undefined,
          direccion_entrega: conocido && otraDireccion ? direccionEntrega.trim() : undefined,
        }
      : datosContacto;

    // Por nombre, el acuerdo sobre el precio del día queda escrito en cada
    // pedido. Por cédula se guarda una vez en el cliente, con su fecha: no
    // hace falta repetirlo en las observaciones.
    const observacionesFinales = porCedula
      ? observaciones.trim()
      : [observaciones.trim(), NOTA_ACUERDO_PRECIOS].filter(Boolean).join("\n\n");

    setEnviando(true);
    try {
      const resp = await crearPedido(cliente, items, observacionesFinales, personalizados);
      useUltimoPedido.getState().guardar(items);
      if (porCedula) recordarCliente(cedula, resp.cliente_nombre ?? null);
      vaciar();
      setPedidoOk({ id: resp.pedido_id, total: resp.total, nombre: resp.cliente_nombre || nombre.trim() });
    } catch (e) {
      setError(mensajeDelServidor(e) ?? "No pudimos registrar tu pedido. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (pedidoOk !== null) {
    const mensajeWhatsapp = (config.whatsapp_mensaje_pedido || "")
      .replace("{nombre}", pedidoOk.nombre)
      .replace("{pedido_id}", String(pedidoOk.id))
      .replace("{total}", formatoPrecio(pedidoOk.total));

    return (
      <div className="contenedor" style={{ padding: "3rem 1.5rem" }}>
        <div className="checkout glass exito">
          <div className="check">
            <CheckCircle2 size={44} />
          </div>
          <h1>¡Pedido recibido!</h1>
          <p>
            Tu pedido <strong>#{pedidoOk.id}</strong> fue registrado con éxito.
            Pronto nos pondremos en contacto contigo.
          </p>
          <div className="checkout-exito-acciones">
            {config.whatsapp_numero && mensajeWhatsapp && (
              <a
                className="btn btn-whatsapp"
                href={whatsappHref(config.whatsapp_numero, mensajeWhatsapp)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={18} /> Confirmar por WhatsApp
              </a>
            )}
            <button className="btn btn-verde" onClick={() => router.push("/tienda")}>
              Volver a la tienda
            </button>
            {porCedula && (
              <Link className="btn btn-outline" href="/tienda/mis-pedidos">
                Ver mis pedidos
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cantidadLineas = totalLineas();

  return (
    <div className="contenedor" style={{ padding: "3rem 1.5rem" }}>
      <div className="checkout glass">
        {items.length === 0 && personalizados.length === 0 ? (
          <>
            <h1>
              <ClipboardList size={24} /> Resumen del pedido
            </h1>
            <div className="vacio">
              Tu carrito está vacío. <Link href="/tienda">Ir a la tienda</Link>
            </div>
          </>
        ) : (
          <form onSubmit={enviar}>
            <div className="checkout-encabezado">
              <h1>
                <ClipboardList size={24} /> Resumen del pedido
                <span className="checkout-contador">{cantidadLineas}</span>
              </h1>
              <Link href="/tienda" className="checkout-editar">
                Editar productos
              </Link>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="resumen">
              <div className="resumen-lista">
                {items.map((i) => (
                  <div className="resumen-item" key={i.presentacionId}>
                    <div className="resumen-item-info">
                      <span className="resumen-item-nombre">{i.productoNombre}</span>
                      <span className="resumen-item-variante">
                        {formatoCantidad(i.cantidad, i.permiteFraccion)} × {i.presentacionNombre}
                      </span>
                    </div>
                    <span className="resumen-item-subtotal">
                      {formatoPrecio(i.precioUnitario * i.cantidad)}
                    </span>
                  </div>
                ))}
                {personalizados.map((p) => (
                  <div className="resumen-item" key={p.id}>
                    <div className="resumen-item-info">
                      <span className="resumen-item-nombre">{p.nombre}</span>
                      <span className="resumen-item-variante">
                        {p.cantidad} {p.unidadNombre || "unid."} · fuera de catálogo
                      </span>
                    </div>
                    <span className="resumen-item-subtotal">Por confirmar</span>
                  </div>
                ))}
              </div>
              <div className="resumen-total">
                <span>Total estimado</span>
                <span>{formatoPrecio(totalPrecio())}</span>
              </div>
              <AvisoPrecios compacto />
            </div>

            {porCedula && (
              <IdentificacionCedula
                cedula={cedula}
                onCedula={setCedula}
                consulta={consulta}
                onConsulta={setConsulta}
                otraDireccion={otraDireccion}
                onOtraDireccion={setOtraDireccion}
                direccionEntrega={direccionEntrega}
                onDireccionEntrega={setDireccionEntrega}
              />
            )}

            {pideDatos && (
            <>
            <div className="campo">
              <label>Nombre o negocio *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Tienda Don José"
                required
              />
            </div>
            <div className="campo">
              <label>Teléfono *</label>
              <div className="campo-telefono">
                <select
                  value={codigoPais}
                  onChange={(e) => setCodigoPais(e.target.value)}
                  aria-label="Código de país"
                >
                  {CODIGOS_PAIS.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="300 123 4567"
                  inputMode="tel"
                  required
                />
              </div>
            </div>
            <div className="campo">
              <label>Dirección de entrega *</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, barrio y una referencia para encontrarte"
                required
              />
            </div>
            </>
            )}

            {(!porCedula || consulta !== null) && (
            <div className="campo">
              <label>Observaciones</label>
              <textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="¿Algo que debamos saber sobre tu pedido?"
              />
            </div>
            )}

            {pideDatos && (
            <label className="checkout-acuerdo">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                required
              />
              <span>
                Confirmo que comprendo que los precios son estimados y estoy de acuerdo
                con que se ajusten según la cotización del día de la cosecha al
                procesarse en el sistema.
                {porCedula && " Solo te lo preguntamos esta vez."}
              </span>
            </label>
            )}

            <p className="checkout-seguridad">
              <Lock size={13} /> Orden encriptada y directa para procesamiento interno
            </p>

            <button
              className="btn btn-verde btn-block"
              type="submit"
              disabled={!listoParaEnviar}
            >
              {enviando ? "Enviando…" : "Enviar orden de compra"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
