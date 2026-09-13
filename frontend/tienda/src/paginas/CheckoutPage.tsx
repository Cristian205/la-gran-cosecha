"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Lock } from "lucide-react";
import { useState } from "react";
import { crearPedido } from "@/lib/datos";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { useCart } from "@/estado/carrito";
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

export function CheckoutPage() {
  const { items, personalizados, vaciar, totalPrecio, totalLineas } = useCart();
  const router = useRouter();
  const { config } = useSiteConfig();

  const [nombre, setNombre] = useState("");
  const [codigoPais, setCodigoPais] = useState(CODIGOS_PAIS[0].valor);
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoOk, setPedidoOk] = useState<{ id: number; total: number } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
    if (items.length === 0 && personalizados.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }
    if (!acepta) {
      setError("Confirma que entiendes que los precios pueden ajustarse antes de continuar.");
      return;
    }

    // El acuerdo sobre el precio del día queda escrito en el propio pedido:
    // sin tocar el contrato del backend (`observaciones` ya es texto libre),
    // deja un rastro de que el cliente lo aceptó al momento de comprar.
    const observacionesConAcuerdo = [observaciones.trim(), NOTA_ACUERDO_PRECIOS]
      .filter(Boolean)
      .join("\n\n");

    setEnviando(true);
    try {
      const resp = await crearPedido(
        { nombre: nombre.trim(), telefono: `${codigoPais} ${telefono.trim()}`, direccion: direccion.trim() },
        items,
        observacionesConAcuerdo,
        personalizados
      );
      useUltimoPedido.getState().guardar(items);
      vaciar();
      setPedidoOk({ id: resp.pedido_id, total: resp.total });
    } catch {
      setError("No pudimos registrar tu pedido. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (pedidoOk !== null) {
    const mensajeWhatsapp = (config.whatsapp_mensaje_pedido || "")
      .replace("{nombre}", nombre.trim())
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
            <div className="campo">
              <label>Observaciones</label>
              <textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="¿Algo que debamos saber sobre tu pedido?"
              />
            </div>

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
              </span>
            </label>

            <p className="checkout-seguridad">
              <Lock size={13} /> Orden encriptada y directa para procesamiento interno
            </p>

            <button
              className="btn btn-verde btn-block"
              type="submit"
              disabled={enviando || !acepta}
            >
              {enviando ? "Enviando…" : "Enviar orden de compra"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
