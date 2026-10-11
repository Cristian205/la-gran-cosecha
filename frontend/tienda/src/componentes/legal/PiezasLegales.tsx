import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Mail,
  MapPin,
  PackageCheck,
  PackageX,
  Pencil,
  Phone,
  RefreshCw,
  Truck,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/componentes/icons/WhatsAppIcon";
import { CATEGORIAS, ELEMENTOS, TERCEROS } from "@/lib/legal/cookies";
import type { ComponenteLegal, DatosLegales } from "@/lib/legal/tipos";
import { telHref, whatsappHref } from "@/lib/utiles";
import { Pendiente, TextoLegal } from "./TextoLegal";
import { TiposPQRS } from "./TiposPQRS";

/**
 * Las piezas de las políticas que se pintan con DATOS y no con texto.
 *
 * Cada una corresponde a un `{ tipo: "componente", nombre }` del contenido,
 * así que una política reescrita desde el panel puede ponerlas donde quiera
 * —o quitarlas— sin tocar código.
 */
export function PiezaLegal({ nombre, datos }: { nombre: ComponenteLegal; datos: DatosLegales }) {
  switch (nombre) {
    case "identificacion":
      return <Identificacion datos={datos} />;
    case "canales":
      return <Canales datos={datos} />;
    case "cobertura":
      return <Cobertura datos={datos} />;
    case "cookies":
      return <Cookies />;
    case "metodos-pago":
      return <MetodosPago datos={datos} />;
    case "estados-pedido":
      return <EstadosPedido />;
    case "derechos-titular":
      return <DerechosTitular />;
    case "casos-devolucion":
      return <CasosDevolucion datos={datos} />;
    case "tipos-pqrs":
      return <TiposPQRS datos={datos} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */

export function TablaDatos({
  filas,
  datos,
}: {
  filas: { etiqueta: string; valor: string }[];
  datos: DatosLegales;
}) {
  return (
    <dl className="legal-datos">
      {filas.map((f) => (
        <div key={f.etiqueta} className="legal-datos-fila">
          <dt>{f.etiqueta}</dt>
          <dd>
            <TextoLegal texto={f.valor} datos={datos} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Identificacion({ datos }: { datos: DatosLegales }) {
  const filas = [
    { etiqueta: "Nombre comercial", valor: "{{nombre}}" },
    { etiqueta: "Razón social", valor: "{{empresa.razon_social}}" },
    { etiqueta: "NIT", valor: "{{empresa.nit}}" },
    {
      etiqueta: "Domicilio",
      valor: datos.empresa.departamento
        ? "{{empresa.direccion}}, {{empresa.ciudad}} ({{empresa.departamento}})"
        : "{{empresa.direccion}}, {{empresa.ciudad}}",
    },
    { etiqueta: "Correo", valor: "{{contacto.correo_atencion}}" },
    { etiqueta: "Teléfono", valor: "{{contacto.telefono}}" },
    { etiqueta: "Sitio web", valor: "{{contacto.sitio_web}}" },
  ];
  // Opcionales: solo se enseñan si el negocio los diligenció.
  if (datos.empresa.representante_legal) filas.splice(3, 0, { etiqueta: "Representante legal", valor: "{{empresa.representante_legal}}" });
  if (datos.empresa.matricula_mercantil) filas.splice(3, 0, { etiqueta: "Matrícula mercantil", valor: "{{empresa.matricula_mercantil}}" });
  return <TablaDatos filas={filas} datos={datos} />;
}

function Canal({ icono, titulo, children, href }: { icono: ReactNode; titulo: string; children: ReactNode; href?: string }) {
  const contenido = (
    <>
      <span className="legal-canal-icono">{icono}</span>
      <span className="legal-canal-texto">
        <small>{titulo}</small>
        <span>{children}</span>
      </span>
    </>
  );
  return href ? (
    <a className="legal-canal legal-canal--enlace" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
      {contenido}
    </a>
  ) : (
    <div className="legal-canal">{contenido}</div>
  );
}

export function Canales({ datos }: { datos: DatosLegales }) {
  const c = datos.contacto;
  const nombre = datos.empresa.nombre_comercial ?? "la tienda";
  return (
    <div className="legal-canales">
      {c.whatsapp && (
        <Canal
          icono={<WhatsAppIcon size={18} />}
          titulo="WhatsApp"
          href={whatsappHref(c.whatsapp, `Hola ${nombre}, tengo una consulta.`)}
        >
          Escríbenos
        </Canal>
      )}
      <Canal icono={<Mail size={18} />} titulo="Correo" href={c.correo_atencion ? `mailto:${c.correo_atencion}` : undefined}>
        {c.correo_atencion ?? <Pendiente ruta="contacto.correo_atencion" />}
      </Canal>
      <Canal icono={<Phone size={18} />} titulo="Teléfono" href={c.telefono ? telHref(c.telefono) : undefined}>
        {c.telefono ?? <Pendiente ruta="contacto.telefono" />}
      </Canal>
      <Canal icono={<Clock size={18} />} titulo="Horario de atención">
        {c.horario_atencion ?? <Pendiente ruta="contacto.horario_atencion" />}
      </Canal>
      {c.direccion_notificaciones && (
        <Canal icono={<MapPin size={18} />} titulo="Dirección">
          {c.direccion_notificaciones}
          {datos.empresa.ciudad ? `, ${datos.empresa.ciudad}` : ""}
        </Canal>
      )}
    </div>
  );
}

function Cobertura({ datos }: { datos: DatosLegales }) {
  const zonas = datos.envios.cobertura ?? [];
  if (!zonas.length) {
    return (
      <p>
        <Pendiente ruta="envios.cobertura" />
      </p>
    );
  }
  return (
    <ul className="legal-chips" aria-label="Zonas de cobertura">
      {zonas.map((z) => (
        <li key={z}>
          <MapPin size={14} aria-hidden="true" /> {z}
        </li>
      ))}
    </ul>
  );
}

function Cookies() {
  return (
    <div className="legal-cookies">
      <div className="legal-categorias">
        {CATEGORIAS.map((c) => (
          <div key={c.id} className={`legal-categoria ${c.enUso ? "" : "legal-categoria--inactiva"}`}>
            <div className="legal-categoria-cabeza">
              <strong>{c.nombre}</strong>
              <span className={`legal-insignia ${c.enUso ? "legal-insignia--ok" : ""}`}>
                {c.obligatoria ? "Siempre activas" : c.enUso ? "En uso" : "No se usan"}
              </span>
            </div>
            <p>{c.descripcion}</p>
          </div>
        ))}
      </div>

      <div className="legal-tabla-envoltorio" role="region" aria-label="Inventario de cookies" tabIndex={0}>
        <table className="legal-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Finalidad</th>
              <th>Duración</th>
            </tr>
          </thead>
          <tbody>
            {ELEMENTOS.map((e) => (
              <tr key={e.nombre}>
                <td data-etiqueta="Nombre"><code>{e.nombre}</code></td>
                <td data-etiqueta="Tipo">{e.tipo}</td>
                <td data-etiqueta="Categoría">{CATEGORIAS.find((c) => c.id === e.categoria)?.nombre}</td>
                <td data-etiqueta="Finalidad">{e.finalidad}</td>
                <td data-etiqueta="Duración">{e.duracion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="legal-subtitulo">Tecnologías de terceros</h3>
      <ul className="legal-lista">
        {TERCEROS.map((t) => (
          <li key={t.nombre}>
            <strong>{t.nombre}.</strong> {t.finalidad}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetodosPago({ datos }: { datos: DatosLegales }) {
  const metodos = datos.pagos.metodos ?? [];
  return (
    <div className="legal-metodos">
      {metodos.map((m) => (
        <div key={m.id} className={`legal-metodo ${m.activo === false ? "legal-metodo--inactivo" : ""}`}>
          <div className="legal-metodo-cabeza">
            <strong>{m.nombre}</strong>
            {m.activo === true && (
              <span className="legal-insignia legal-insignia--ok">
                <CheckCircle2 size={13} aria-hidden="true" /> Disponible
              </span>
            )}
            {m.activo === false && (
              <span className="legal-insignia">
                <Ban size={13} aria-hidden="true" /> No disponible
              </span>
            )}
            {m.activo === null && (
              <span className="legal-insignia legal-insignia--pendiente">
                <CircleDashed size={13} aria-hidden="true" /> Por confirmar
              </span>
            )}
          </div>
          <p>{m.descripcion}</p>
        </div>
      ))}
    </div>
  );
}

/** Los estados que tiene un pedido en el sistema (`orders.Pedido.ESTADOS`), dichos para el cliente. */
const ESTADOS = [
  { nombre: "Pendiente", icono: Clock, texto: "Recibimos tu pedido. Lo estamos revisando para confirmar disponibilidad y valor final." },
  { nombre: "Editado", icono: Pencil, texto: "Ajustamos el pedido —cantidades, reemplazos o precio del día— y te lo confirmamos." },
  { nombre: "Cerrado", icono: PackageCheck, texto: "El pedido está confirmado con su valor final y se prepara para la entrega." },
  { nombre: "Entregado", icono: Truck, texto: "El pedido llegó a la dirección acordada." },
];

function EstadosPedido() {
  return (
    <ol className="legal-estados">
      {ESTADOS.map(({ nombre, icono: Icono, texto }) => (
        <li key={nombre}>
          <span className="legal-estado-icono">
            <Icono size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>{nombre}</strong>
            <span>{texto}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const DERECHOS = [
  "Conocer, actualizar y rectificar tus datos personales.",
  "Solicitar prueba de la autorización que nos otorgaste, salvo cuando la ley no la exige.",
  "Ser informado, previa solicitud, del uso que le hemos dado a tus datos.",
  "Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley, una vez agotado el trámite de reclamo ante nosotros.",
  "Revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios, derechos y garantías legales, y no exista un deber legal o contractual de conservarlos.",
  "Acceder en forma gratuita a tus datos personales.",
  "Abstenerte de responder preguntas sobre datos sensibles o sobre niños, niñas y adolescentes.",
];

function DerechosTitular() {
  return (
    <>
      <p>Como titular de los datos, conforme al artículo 8 de la Ley 1581 de 2012, tienes derecho a:</p>
      <ul className="legal-lista legal-lista--check">
        {DERECHOS.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </>
  );
}

function CasosDevolucion({ datos }: { datos: DatosLegales }) {
  const casos = [
    {
      icono: AlertTriangle,
      titulo: "Producto defectuoso o en mal estado",
      texto: "Llegó dañado, en mal estado o no apto para el consumo. Lo reponemos o te devolvemos su valor, sin costo para ti.",
      plazo: "{{devoluciones.plazo_reporte}}",
    },
    {
      icono: PackageX,
      titulo: "Producto incorrecto o faltante",
      texto: "Recibiste algo distinto a lo confirmado, en otra presentación o cantidad, o faltó un producto. Lo corregimos sin costo.",
      plazo: "{{devoluciones.plazo_reporte}}",
    },
    {
      icono: RefreshCw,
      titulo: "Cambio",
      texto: "El producto está bien pero prefieres otro. Aplica solo a productos no perecederos y en las condiciones de esta política.",
      plazo: "{{devoluciones.plazo_cambios}}",
    },
    {
      icono: Undo2,
      titulo: "Devolución",
      texto: "Devuelves el producto y recibes el reembolso. Procede por defecto, por producto incorrecto o al ejercer el retracto cuando aplica.",
      plazo: "{{devoluciones.plazo_reporte}}",
    },
    {
      icono: Ban,
      titulo: "Derecho de retracto",
      texto: "Desistir de la compra dentro de los 5 días hábiles siguientes a la entrega. No aplica a productos perecederos ni personalizados.",
      plazo: "5 días hábiles desde la entrega",
    },
  ];
  return (
    <div className="legal-casos">
      {casos.map(({ icono: Icono, titulo, texto, plazo }) => (
        <div key={titulo} className="legal-caso">
          <span className="legal-caso-icono">
            <Icono size={18} aria-hidden="true" />
          </span>
          <strong>{titulo}</strong>
          <p>{texto}</p>
          <span className="legal-caso-plazo">
            <Clock size={13} aria-hidden="true" /> Plazo: <TextoLegal texto={plazo} datos={datos} />
          </span>
        </div>
      ))}
    </div>
  );
}
