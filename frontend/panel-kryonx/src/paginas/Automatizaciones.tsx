/**
 * Automatizaciones: lo que la plataforma hace sola cuando algo pasa.
 *
 * Hoy son los avisos por WhatsApp. El catálogo es el de
 * `backend/apps/mensajeria/eventos.py` —qué evento, a quién y qué lo
 * dispara—; se repite aquí porque la API no lo expone todavía. Si se añade un
 * evento allí, hay que añadirlo aquí: la lista es corta y cambia poco.
 */
import type { ReactNode } from "react";
import { Bell, MessageCircle, Store, User } from "lucide-react";
import { Insignia, Tarjeta } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";

interface Automatizacion {
  codigo: string;
  nombre: string;
  disparador: string;
}

const AL_CLIENTE: Automatizacion[] = [
  { codigo: "PEDIDO_RECIBIDO", nombre: "Pedido recibido", disparador: "Se crea un pedido desde la tienda o el panel" },
  { codigo: "PEDIDO_AJUSTADO", nombre: "Pedido ajustado", disparador: "El pedido pasa a Editado" },
  { codigo: "PEDIDO_CONFIRMADO", nombre: "Pedido confirmado", disparador: "El pedido pasa a Cerrado" },
  { codigo: "PEDIDO_EN_CAMINO", nombre: "Pedido en camino", disparador: "El envío sale a ruta" },
  { codigo: "PEDIDO_ENTREGADO", nombre: "Pedido entregado", disparador: "El pedido pasa a Entregado" },
];

const AL_NEGOCIO: Automatizacion[] = [
  { codigo: "ALERTA_PEDIDO_NUEVO", nombre: "Pedido nuevo", disparador: "Entra un pedido" },
  { codigo: "ALERTA_MENSAJE_CONTACTO", nombre: "Mensaje de contacto", disparador: "Alguien escribe desde el formulario de contacto" },
  { codigo: "ALERTA_ENVIO_DEVUELTO", nombre: "Envío devuelto", disparador: "Un envío vuelve sin entregarse" },
  { codigo: "ALERTA_GENERAL", nombre: "Alerta general", disparador: "Cualquier parte del sistema lo solicita" },
];

function Flujo({ titulo, icono, filas }: { titulo: string; icono: ReactNode; filas: Automatizacion[] }) {
  return (
    <Tarjeta titulo={<h2 className="titulo-con-icono">{icono}{titulo}</h2>} accion={<span className="tenue">{filas.length} flujos</span>}>
      <ul className="flujos">
        {filas.map((a) => (
          <li key={a.codigo} className="flujo">
            <span className="flujo__paso flujo__paso--cuando">
              <Bell size={13} /> {a.disparador}
            </span>
            <span className="flujo__flecha" aria-hidden="true" />
            <span className="flujo__paso flujo__paso--entonces">
              <MessageCircle size={13} /> {a.nombre}
            </span>
            <code className="flujo__codigo">{a.codigo}</code>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function Automatizaciones() {
  return (
    <>
      <EncabezadoPagina
        antetitulo="Sistema"
        titulo="Automatizaciones"
        descripcion="Lo que la plataforma hace sola cuando algo ocurre en una tienda."
        acciones={<Insignia tono="info">Canal: WhatsApp</Insignia>}
      />
      <p className="nota-seccion">
        Cada empresa las enciende desde su configuración de WhatsApp y puede apagar eventos sueltos.
        Las que exigen consentimiento solo se envían a clientes que lo dieron al comprar.
      </p>
      <div className="rejilla-dos">
        <Flujo titulo="Avisos al cliente" icono={<User size={15} />} filas={AL_CLIENTE} />
        <Flujo titulo="Alertas al negocio" icono={<Store size={15} />} filas={AL_NEGOCIO} />
      </div>
    </>
  );
}
