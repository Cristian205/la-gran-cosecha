"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList, IdCard, MapPin, MessageSquareText, Phone, UserRound } from "lucide-react";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { useCart } from "@/estado/carrito";
import { partesPresentacion } from "@/lib/cantidadHumana";
import { formatoCantidad, formatoPrecio } from "@/lib/utiles";
import type { Paso } from "./PasosCheckout";
import { textoReferencias, textoUnidades } from "./PasoRevision";

/** Cuántas líneas del pedido se listan en el resumen final antes de "y N más". */
const LINEAS_EN_RESUMEN = 6;

export interface ResumenCliente {
  nombre: string;
  documento?: string;
  telefono: string;
  direccion: string;
  /** Otra dirección solo para este pedido (cliente conocido). */
  direccionEntrega?: string;
  /** Lo que pidió cambiar y el negocio verificará. */
  solicitud?: string;
}

interface Props {
  cliente: ResumenCliente;
  observaciones: string;
  onObservaciones: (texto: string) => void;
  /** Qué consentimientos faltan por dar, según quién es (ver CheckoutPage). */
  pideAcuerdo: boolean;
  pideAutorizacion: boolean;
  preguntaWhatsapp: boolean;
  acepta: boolean;
  onAcepta: (v: boolean) => void;
  autorizaDatos: boolean;
  onAutorizaDatos: (v: boolean) => void;
  aceptaWhatsapp: boolean;
  onAceptaWhatsapp: (v: boolean) => void;
  /** Recordatorio "solo te lo preguntamos esta vez" (modo cédula). */
  unaSolaVez: boolean;
  onEditar: (paso: Paso) => void;
  /** El paso donde se corrigen los datos del cliente. */
  pasoDatos: Paso;
}

/**
 * Paso 4: todo lo que se va a enviar, de un vistazo, con un "Editar" en cada
 * bloque que lleva a su paso. Aquí se dan los consentimientos —justo antes
 * de enviar, que es cuando tienen sentido— y se escriben las observaciones.
 */
export function PasoConfirmacion(props: Props) {
  const { cliente, observaciones, onObservaciones, onEditar, pasoDatos } = props;
  const { items, personalizados, totalPrecio } = useCart();
  const referencias = items.length + personalizados.length;
  const unidades =
    items.reduce((s, i) => s + i.cantidad, 0) + personalizados.reduce((s, p) => s + p.cantidad, 0);
  const primeras = items.slice(0, LINEAS_EN_RESUMEN);
  const ocultas = referencias - primeras.length;

  return (
    <section className="chk-seccion" aria-labelledby="chk-confirmar-titulo">
      <h2 className="chk-titulo" id="chk-confirmar-titulo" tabIndex={-1}>
        <CheckCircle2 size={20} aria-hidden="true" /> Revisa y envía tu pedido
      </h2>
      <p className="chk-texto">Comprueba que todo esté bien. Puedes corregir cualquier bloque antes de enviar.</p>

      <div className="chk-bloque">
        <div className="chk-bloque-cab">
          <h3>Quién pide</h3>
          <button type="button" className="ident-cambiar" onClick={() => onEditar(pasoDatos)}>
            Editar
          </button>
        </div>
        <ul className="chk-datos">
          <li>
            <UserRound size={15} aria-hidden="true" /> {cliente.nombre}
          </li>
          {cliente.documento && (
            <li>
              <IdCard size={15} aria-hidden="true" /> Cédula {cliente.documento}
            </li>
          )}
          {cliente.telefono && (
            <li>
              <Phone size={15} aria-hidden="true" /> {cliente.telefono}
            </li>
          )}
        </ul>
        {cliente.solicitud && (
          <p className="chk-solicitud">
            <MessageSquareText size={15} aria-hidden="true" />
            <span>
              Pediste actualizar tus datos: «{cliente.solicitud}». El negocio lo verificará contigo.
            </span>
          </p>
        )}
      </div>

      <div className="chk-bloque">
        <div className="chk-bloque-cab">
          <h3>Dónde entregamos</h3>
          <button type="button" className="ident-cambiar" onClick={() => onEditar(pasoDatos)}>
            Editar
          </button>
        </div>
        <p className="chk-direccion">
          <MapPin size={15} aria-hidden="true" />
          <span>
            {cliente.direccionEntrega || cliente.direccion}
            {cliente.direccionEntrega && <small> Solo para este pedido</small>}
          </span>
        </p>
      </div>

      <div className="chk-bloque">
        <div className="chk-bloque-cab">
          <h3>
            <ClipboardList size={16} aria-hidden="true" /> Tu pedido
          </h3>
          <button type="button" className="ident-cambiar" onClick={() => onEditar("pedido")}>
            Editar
          </button>
        </div>
        <p className="chk-contadores">
          <span>{textoReferencias(referencias)}</span>
          <span aria-hidden="true">·</span>
          <span>{textoUnidades(unidades)}</span>
        </p>
        <ul className="chk-resumen-lineas">
          {primeras.map((i) => {
            const { variante, unidad } = partesPresentacion(i.presentacionNombre);
            return (
              <li key={i.presentacionId}>
                <span>
                  <b>{i.productoNombre}</b> {formatoCantidad(i.cantidad, i.permiteFraccion)} ×{" "}
                  {[variante, unidad].filter(Boolean).join(" · ")}
                </span>
                <span>{formatoPrecio(i.precioUnitario * i.cantidad)}</span>
              </li>
            );
          })}
        </ul>
        {ocultas > 0 && (
          <button type="button" className="chk-ver-mas" onClick={() => onEditar("pedido")}>
            y {ocultas} {ocultas === 1 ? "producto más" : "productos más"} — ver todo el pedido
          </button>
        )}
        <div className="resumen-total">
          <span>Total estimado</span>
          <span>{formatoPrecio(totalPrecio())}</span>
        </div>
        <AvisoPrecios compacto />
      </div>

      <div className="campo">
        <label htmlFor="chk-observaciones">Observaciones</label>
        <textarea
          id="chk-observaciones"
          rows={3}
          value={observaciones}
          onChange={(e) => onObservaciones(e.target.value)}
          placeholder="¿Algo que debamos saber? Horario de entrega, cómo encontrarte…"
        />
      </div>

      <Consentimientos {...props} />
    </section>
  );
}

function Consentimientos({
  pideAcuerdo,
  pideAutorizacion,
  preguntaWhatsapp,
  acepta,
  onAcepta,
  autorizaDatos,
  onAutorizaDatos,
  aceptaWhatsapp,
  onAceptaWhatsapp,
  unaSolaVez,
}: Props) {
  return (
    <>
      {pideAcuerdo && (
        <label className="checkout-acuerdo">
          <input type="checkbox" checked={acepta} onChange={(e) => onAcepta(e.target.checked)} />
          <span>
            Confirmo que comprendo que los precios son estimados y estoy de acuerdo con que se
            ajusten según la cotización del día de la cosecha al procesarse en el sistema.
            {unaSolaVez && " Solo te lo preguntamos esta vez."}
          </span>
        </label>
      )}
      {preguntaWhatsapp && (
        <label className="checkout-acuerdo checkout-acuerdo--opcional">
          <input type="checkbox" checked={aceptaWhatsapp} onChange={(e) => onAceptaWhatsapp(e.target.checked)} />
          <span>
            Quiero recibir por WhatsApp la confirmación y el estado de mi pedido. Puedes dejar de
            recibirlos cuando quieras respondiendo «BAJA».
          </span>
        </label>
      )}
      {pideAutorizacion && (
        <label className="checkout-acuerdo">
          <input type="checkbox" checked={autorizaDatos} onChange={(e) => onAutorizaDatos(e.target.checked)} />
          <span>
            Autorizo el tratamiento de mis datos personales para gestionar mi pedido, según la{" "}
            <Link href="/politica-tratamiento-datos" target="_blank" rel="noopener">
              Política de Tratamiento de Datos
            </Link>{" "}
            y los{" "}
            <Link href="/terminos-y-condiciones" target="_blank" rel="noopener">
              Términos y Condiciones
            </Link>
            .
          </span>
        </label>
      )}
    </>
  );
}
