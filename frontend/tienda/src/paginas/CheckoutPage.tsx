"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, Lock, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { crearPedido, type DatosCliente } from "@/lib/datos";
import type { ClienteConsultado, RespuestaPedido } from "@/lib/tipos";
import { useSiteConfig } from "@/componentes/CapaCliente";
import { useCarritoHidratado } from "@/componentes/CartDrawer";
import { PasosCheckout, type Paso } from "@/componentes/checkout/PasosCheckout";
import { PasoIdentificacion, cedulaOculta } from "@/componentes/checkout/PasoIdentificacion";
import {
  CODIGOS_PAIS,
  PasoDatos,
  type Actualizacion,
  type DatosNuevos,
} from "@/componentes/checkout/PasoDatos";
import { PasoRevision, textoReferencias } from "@/componentes/checkout/PasoRevision";
import { PasoConfirmacion, type ResumenCliente } from "@/componentes/checkout/PasoConfirmacion";
import { PedidoRegistrado } from "@/componentes/checkout/PedidoRegistrado";
import { useCart } from "@/estado/carrito";
import { useClienteTienda } from "@/estado/clienteTienda";
import { useUltimoPedido } from "@/estado/ultimoPedido";
import { formatoPrecio } from "@/lib/utiles";

const NOTA_ACUERDO_PRECIOS =
  "El cliente confirma que los precios son estimados y acepta que se ajusten " +
  "según la cotización del día de la cosecha al procesarse en el sistema.";

const PASOS_CEDULA: Paso[] = ["identificacion", "datos", "pedido", "confirmar"];
const PASOS_NOMBRE: Paso[] = ["datos", "pedido", "confirmar"];

const DATOS_VACIOS: DatosNuevos = { nombre: "", negocio: "", codigoPais: CODIGOS_PAIS[0].valor, telefono: "", direccion: "" };
const SIN_ACTUALIZACION: Actualizacion = { direccionEntrega: "", solicitud: "" };

/** El primer mensaje que el servidor dio para los datos del cliente, si dio uno. */
function mensajeDelServidor(error: unknown): string | null {
  const detalle = (error as { detalle?: { cliente?: Record<string, unknown> } })?.detalle;
  for (const valor of Object.values(detalle?.cliente ?? {})) {
    if (Array.isArray(valor) && typeof valor[0] === "string") return valor[0];
    if (typeof valor === "string") return valor;
  }
  return null;
}

/**
 * El checkout guiado: identificación → tus datos → tu pedido → confirmar.
 *
 * Este componente solo orquesta: qué paso se ve, a cuáles se puede volver,
 * qué hace falta para avanzar y el envío final. Cada paso vive en
 * `componentes/checkout/`. La lógica de negocio del envío es la de siempre
 * (los mismos campos a `crearPedido`): el servidor sigue siendo quien decide
 * qué datos y consentimientos exige, y vuelve a validar todo.
 *
 * Tiendas que identifican por nombre en vez de por cédula: tres pasos (sin
 * identificación), con el mismo formulario de datos.
 */
export function CheckoutPage() {
  const { items, personalizados, vaciar, totalPrecio } = useCart();
  const hidratado = useCarritoHidratado();
  const { config } = useSiteConfig();
  const porCedula = config.identificacion_clientes === "cedula";
  const recordarCliente = useClienteTienda((s) => s.recordar);
  const olvidarCliente = useClienteTienda((s) => s.olvidar);

  const pasos = porCedula ? PASOS_CEDULA : PASOS_NOMBRE;
  const [pasoElegido, setPaso] = useState<Paso>(pasos[0]);
  const paso = pasos.includes(pasoElegido) ? pasoElegido : pasos[0];
  const indice = pasos.indexOf(paso);
  const [alcanzado, setAlcanzado] = useState(0);
  const tarjeta = useRef<HTMLDivElement>(null);
  const tituloExito = useRef<HTMLHeadingElement>(null);
  const primerPaso = useRef(true);

  // Identificación y datos.
  const [cedula, setCedula] = useState("");
  const [consulta, setConsulta] = useState<ClienteConsultado | null>(null);
  const [datos, setDatos] = useState<DatosNuevos>(DATOS_VACIOS);
  const [errores, setErrores] = useState<Partial<Record<keyof DatosNuevos, string>>>({});
  const [datosConfirmados, setDatosConfirmados] = useState(false);
  const [actualizacion, setActualizacion] = useState<Actualizacion>(SIN_ACTUALIZACION);

  // Confirmación.
  const [observaciones, setObservaciones] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [autorizaDatos, setAutorizaDatos] = useState(false);
  // Desmarcada de entrada a propósito: un consentimiento premarcado no vale
  // ni para Meta ni para la Ley 1581.
  const [aceptaWhatsapp, setAceptaWhatsapp] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidoOk, setPedidoOk] = useState<{ respuesta: RespuestaPedido; nombre: string } | null>(null);

  // Cliente conocido: ya dio sus datos y aceptó el acuerdo en su primer pedido.
  const conocido = porCedula && consulta !== null && consulta.existe && !consulta.requiere_datos;
  // Datos de contacto y acuerdo de precios: siempre por nombre; por cédula,
  // solo mientras el cliente no los haya dado.
  const pideDatos = !conocido;
  const pideAutorizacion = porCedula ? pideDatos || consulta?.requiere_autorizacion === true : true;
  const preguntaWhatsapp = porCedula ? pideDatos || consulta?.pregunta_whatsapp === true : true;
  const referencias = items.length + personalizados.length;

  // Al cambiar de paso: arriba de la tarjeta y el foco en el título del paso,
  // para que el lector de pantalla anuncie dónde se está (no en la primera
  // pintura: ahí nadie cambió de paso).
  useEffect(() => {
    if (primerPaso.current) {
      primerPaso.current = false;
      return;
    }
    tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    tarjeta.current?.querySelector<HTMLElement>(".chk-titulo")?.focus({ preventScroll: true });
  }, [paso]);

  // Pedido enviado: la confirmación es corta y la página venía bajada (la
  // confirmación del paso 4 es larga), así que se quedaba mirando el pie. Se
  // sube de golpe —sin animación: es un cambio de pantalla, no un recorrido—
  // y el foco va al "¡Pedido recibido!".
  useEffect(() => {
    if (!pedidoOk) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    tituloExito.current?.focus({ preventScroll: true });
  }, [pedidoOk]);

  function ir(destino: Paso) {
    const i = pasos.indexOf(destino);
    if (i === -1) return;
    setError(null);
    setPaso(destino);
    setAlcanzado((a) => Math.max(a, i));
  }

  function identificado(respuesta: ClienteConsultado) {
    setConsulta(respuesta);
    setDatosConfirmados(false);
    setActualizacion(SIN_ACTUALIZACION);
    setErrores({});
    ir("datos");
  }

  function cambiarCedula() {
    olvidarCliente();
    setConsulta(null);
    setCedula("");
    setDatosConfirmados(false);
    setActualizacion(SIN_ACTUALIZACION);
    setAlcanzado(0);
    setError(null);
    setPaso("identificacion");
  }

  function validarRegistro(): boolean {
    const faltan: Partial<Record<keyof DatosNuevos, string>> = {};
    if (!datos.nombre.trim()) faltan.nombre = "Escribe tu nombre.";
    if (!datos.negocio.trim()) faltan.negocio = "Escribe el nombre de tu negocio.";
    if (soloDigitosTel(datos.telefono).length < 7) faltan.telefono = "Escribe un teléfono de contacto válido.";
    if (!datos.direccion.trim()) faltan.direccion = "Escribe la dirección de entrega.";
    setErrores(faltan);
    const primero = Object.keys(faltan)[0];
    if (primero) document.getElementById(`chk-${primero}`)?.focus();
    return !primero;
  }

  function avanzar() {
    if (paso === "datos") {
      if (conocido) {
        if (datosConfirmados) ir("pedido");
        return;
      }
      if (validarRegistro()) ir("pedido");
      return;
    }
    if (paso === "pedido") {
      if (referencias > 0) ir("confirmar");
      return;
    }
    if (paso === "confirmar") void enviar();
  }

  const listoParaEnviar =
    !enviando && referencias > 0 && (!pideDatos || acepta) && (!pideAutorizacion || autorizaDatos);

  async function enviar() {
    setError(null);
    if (referencias === 0) {
      setError("Tu pedido está vacío.");
      return;
    }
    if (pideDatos && !acepta) {
      setError("Confirma que entiendes que los precios pueden ajustarse antes de enviar.");
      return;
    }
    if (pideAutorizacion && !autorizaDatos) {
      setError("Para enviar el pedido necesitamos tu autorización para tratar tus datos personales.");
      return;
    }

    const consentimientos: DatosCliente = {
      ...(pideAutorizacion ? { autoriza_datos: true } : {}),
      ...(preguntaWhatsapp ? { acepta_whatsapp: aceptaWhatsapp } : {}),
    };
    const datosContacto: DatosCliente = {
      ...(pideDatos
        ? {
            nombre: datos.nombre.trim(),
            negocio: datos.negocio.trim(),
            telefono: `${datos.codigoPais} ${datos.telefono.trim()}`,
            direccion: datos.direccion.trim(),
          }
        : {}),
      ...consentimientos,
    };
    const direccionEntrega = conocido ? actualizacion.direccionEntrega.trim() : "";
    const cliente: DatosCliente = porCedula
      ? {
          ...datosContacto,
          cedula,
          acepta_precios: pideDatos ? acepta : undefined,
          direccion_entrega: direccionEntrega || undefined,
        }
      : datosContacto;

    // La solicitud de cambio de datos viaja al negocio en las observaciones:
    // el servidor no deja que la tienda reescriba la ficha de un cliente
    // conocido (ver `PasoDatos`). Por nombre, el acuerdo sobre el precio del
    // día queda escrito en cada pedido; por cédula se guarda una vez en el
    // cliente, con su fecha.
    const solicitud = conocido ? actualizacion.solicitud.trim() : "";
    const observacionesFinales = [
      observaciones.trim(),
      solicitud ? `Solicitud de actualización de datos del cliente (verificar con él antes de cambiarlos): ${solicitud}` : "",
      porCedula ? "" : NOTA_ACUERDO_PRECIOS,
    ]
      .filter(Boolean)
      .join("\n\n");

    setEnviando(true);
    try {
      const resp = await crearPedido(cliente, items, observacionesFinales, personalizados);
      useUltimoPedido.getState().guardar(items);
      if (porCedula) recordarCliente(cedula, resp.cliente_nombre ?? null);
      vaciar();
      setPedidoOk({ respuesta: resp, nombre: resp.cliente_nombre || datos.nombre.trim() });
    } catch (e) {
      setError(mensajeDelServidor(e) ?? "No pudimos registrar tu pedido. Revisa tu conexión e intenta nuevamente.");
      tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setEnviando(false);
    }
  }

  if (pedidoOk !== null) {
    return (
      <PedidoRegistrado
        ref={tituloExito}
        pedido={pedidoOk.respuesta}
        nombre={pedidoOk.nombre}
        cedula={porCedula ? cedula : null}
      />
    );
  }

  // Sin nada que pedir (y ya leído el carrito guardado): directo a la tienda.
  // Si se vacía A MITAD del checkout, el paso "Tu pedido" lo dice en su sitio.
  if (hidratado && referencias === 0 && alcanzado === 0) {
    return (
      <div className="contenedor" style={{ padding: "3rem 1.5rem" }}>
        <div className="checkout glass">
          <h1>
            <ClipboardList size={24} /> Tu pedido
          </h1>
          <div className="vacio">
            Tu carrito está vacío. <Link href="/tienda">Ir a la tienda</Link>
          </div>
        </div>
      </div>
    );
  }

  const resumenCliente: ResumenCliente = conocido
    ? {
        nombre: consulta?.nombre ?? "",
        documento: cedulaOculta(cedula),
        telefono: consulta?.telefono ?? "",
        direccion: consulta?.direccion ?? "",
        direccionEntrega: actualizacion.direccionEntrega.trim() || undefined,
        solicitud: actualizacion.solicitud.trim() || undefined,
      }
    : {
        nombre: datos.nombre.trim(),
        documento: porCedula ? cedulaOculta(cedula) : undefined,
        telefono: datos.telefono.trim() ? `${datos.codigoPais} ${datos.telefono.trim()}` : "",
        direccion: datos.direccion.trim(),
      };

  // El botón principal del pie: qué hace y si se puede pulsar en este paso.
  // `corto`: el mismo botón en el teléfono, donde comparte el pie con el total.
  const principal =
    paso === "identificacion"
      ? null // el paso tiene su propio "Continuar", junto a la cédula
      : paso === "datos"
        ? conocido && !datosConfirmados
          ? null // se avanza con "Sí, estos son mis datos" o "Actualizar"
          : { texto: "Continuar a tu pedido", corto: "Continuar", listo: true }
        : paso === "pedido"
          ? { texto: "Continuar a confirmar", corto: "Continuar", listo: referencias > 0 }
          : enviando
            ? { texto: "Enviando…", corto: "Enviando…", listo: false }
            : { texto: "Enviar orden de compra", corto: "Enviar pedido", listo: listoParaEnviar };

  return (
    <div className="contenedor chk-pagina">
      <div className="checkout glass chk" ref={tarjeta}>
        <PasosCheckout pasos={pasos} actual={paso} alcanzado={alcanzado} onIr={ir} />

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        {!hidratado ? (
          <p className="chk-estado" role="status">
            <Loader2 size={16} className="girando" aria-hidden="true" /> Cargando tu pedido…
          </p>
        ) : (
          <>
            {paso === "identificacion" && (
              <PasoIdentificacion cedula={cedula} onCedula={setCedula} onIdentificado={identificado} />
            )}
            {paso === "datos" && (
              <PasoDatos
                porCedula={porCedula}
                cedula={cedula}
                consulta={consulta}
                conocido={conocido}
                datos={datos}
                onDatos={(d) => {
                  setDatos(d);
                  if (Object.keys(errores).length) setErrores({});
                }}
                errores={errores}
                actualizacion={actualizacion}
                onActualizacion={setActualizacion}
                onConfirmar={() => {
                  setDatosConfirmados(true);
                  ir("pedido");
                }}
                onCambiarCedula={cambiarCedula}
              />
            )}
            {paso === "pedido" && <PasoRevision />}
            {paso === "confirmar" && (
              <PasoConfirmacion
                cliente={resumenCliente}
                observaciones={observaciones}
                onObservaciones={setObservaciones}
                pideAcuerdo={pideDatos}
                pideAutorizacion={pideAutorizacion}
                preguntaWhatsapp={preguntaWhatsapp}
                acepta={acepta}
                onAcepta={setAcepta}
                autorizaDatos={autorizaDatos}
                onAutorizaDatos={setAutorizaDatos}
                aceptaWhatsapp={aceptaWhatsapp}
                onAceptaWhatsapp={setAceptaWhatsapp}
                unaSolaVez={porCedula}
                onEditar={ir}
                pasoDatos="datos"
              />
            )}
          </>
        )}

        {/* El pie: el total siempre a la vista (también con 100 líneas en la
            revisión) y la navegación entre pasos. Fijo abajo mientras se
            recorre la tarjeta. */}
        <div className="chk-pie">
          {indice > 0 ? (
            <button type="button" className="chk-atras" onClick={() => ir(pasos[indice - 1])}>
              <ArrowLeft size={16} aria-hidden="true" /> <span>Atrás</span>
            </button>
          ) : (
            <Link href="/tienda" className="chk-atras">
              <ArrowLeft size={16} aria-hidden="true" /> <span>Tienda</span>
            </Link>
          )}
          <div className="chk-pie-total" aria-live="polite">
            <span>
              Total estimado<span className="chk-pie-refs"> · {textoReferencias(referencias)}</span>
            </span>
            <b>{formatoPrecio(totalPrecio())}</b>
          </div>
          {principal && (
            <button
              type="button"
              className="btn btn-verde chk-siguiente"
              onClick={avanzar}
              disabled={!principal.listo || enviando}
            >
              {paso === "confirmar" ? (
                enviando ? (
                  <Loader2 size={17} className="girando" aria-hidden="true" />
                ) : (
                  <Send size={16} aria-hidden="true" />
                )
              ) : null}
              <span className="chk-siguiente-largo">{principal.texto}</span>
              <span className="chk-siguiente-corto" aria-hidden="true">
                {principal.corto}
              </span>
              {paso !== "confirmar" && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
        {paso === "confirmar" && (
          <p className="checkout-seguridad">
            <Lock size={13} /> Orden encriptada y directa para procesamiento interno
          </p>
        )}
      </div>
    </div>
  );
}

function soloDigitosTel(texto: string): string {
  return texto.replace(/\D/g, "");
}
