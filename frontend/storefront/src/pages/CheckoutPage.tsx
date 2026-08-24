import { CheckCircle2, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { crearPedido } from "../api/orders";
import { AvisoPrecios } from "../components/AvisoPrecios";
import { WhatsAppIcon } from "../components/icons/WhatsAppIcon";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useCart } from "../store/cart";
import { useUltimoPedido } from "../store/ultimoPedido";
import { formatoCantidad, formatoPrecio, whatsappHref } from "../utils";

export function CheckoutPage() {
  const { items, personalizados, vaciar, totalPrecio } = useCart();
  const navigate = useNavigate();
  const { config } = useSiteConfig();

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [observaciones, setObservaciones] = useState("");
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
    if (items.length === 0 && personalizados.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }

    setEnviando(true);
    try {
      const resp = await crearPedido(
        { nombre: nombre.trim(), telefono, direccion },
        items,
        observaciones,
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
            <button className="btn btn-verde" onClick={() => navigate("/tienda")}>
              Volver a la tienda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ padding: "3rem 1.5rem" }}>
      <div className="checkout glass">
        <h1>
          <ClipboardList size={24} /> Finalizar pedido
        </h1>

        {items.length === 0 && personalizados.length === 0 ? (
          <div className="vacio">
            Tu carrito está vacío. <Link to="/tienda">Ir a la tienda</Link>
          </div>
        ) : (
          <form onSubmit={enviar}>
            {error && <div className="error-box">{error}</div>}

            <div className="resumen">
              {items.map((i) => (
                <div className="r" key={i.presentacionId}>
                  <span>
                    {formatoCantidad(i.cantidad, i.permiteFraccion)} × {i.productoNombre} (
                    {i.presentacionNombre})
                  </span>
                  <span>{formatoPrecio(i.precioUnitario * i.cantidad)}</span>
                </div>
              ))}
              {personalizados.map((p) => (
                <div className="r" key={p.id}>
                  <span>
                    {p.cantidad} {p.unidadNombre || "unid."} × {p.nombre} (fuera de catálogo)
                  </span>
                  <span>Por confirmar</span>
                </div>
              ))}
              <div className="r" style={{ fontWeight: 800, fontSize: "1.05rem" }}>
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
              <label>Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 300 123 4567"
              />
            </div>
            <div className="campo">
              <label>Dirección de entrega</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Barrio, calle, referencias"
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

            <button className="btn btn-verde btn-block" type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Confirmar pedido"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
