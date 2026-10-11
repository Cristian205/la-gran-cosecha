/**
 * Integraciones: los servicios externos de los que depende la plataforma.
 *
 * Dos tienen estado medible —la base de datos y el almacenamiento, que
 * `/healthz` reporta— y se pintan con ese estado. Los otros dos se configuran
 * con variables del servidor o por empresa y no exponen cómo están; para ellos
 * la tarjeta dice dónde se configuran en vez de fingir un «Conectado».
 */
import type { ElementType } from "react";
import { Database, HardDrive, Mail, MessageCircle } from "lucide-react";
import { usarSalud } from "../datos/salud";
import { Insignia } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";
import type { Tono } from "../datos/derivados";

interface Integracion {
  id: string;
  nombre: string;
  proveedor: string;
  descripcion: string;
  icono: ElementType;
  estado: { tono: Tono; texto: string };
  detalle: string;
}

export function Integraciones() {
  const { healthz, comprobadoEn } = usarSalud();
  const r2Completo = healthz?.r2_config ? Object.values(healthz.r2_config).every(Boolean) : false;

  const integraciones: Integracion[] = [
    {
      id: "base",
      nombre: "Base de datos",
      proveedor: "PostgreSQL · Supabase",
      descripcion: "Todos los datos de la plataforma y de cada empresa, aislados por negocio.",
      icono: Database,
      estado: !healthz
        ? { tono: "neutro", texto: comprobadoEn ? "Sin respuesta" : "Comprobando…" }
        : healthz.database === "ok"
          ? { tono: "ok", texto: "Conectada" }
          : { tono: "malo", texto: "Error" },
      detalle: "Estado medido por /healthz cada minuto.",
    },
    {
      id: "almacenamiento",
      nombre: "Almacenamiento de archivos",
      proveedor: healthz?.storage === "r2" ? "Cloudflare R2" : "Disco local",
      descripcion: "Logos, banners y fotos de producto de todas las tiendas.",
      icono: HardDrive,
      estado: !healthz
        ? { tono: "neutro", texto: comprobadoEn ? "Sin respuesta" : "Comprobando…" }
        : healthz.storage === "r2" && r2Completo
          ? { tono: "ok", texto: "Conectado" }
          : { tono: "aviso", texto: "Disco local" },
      detalle:
        healthz && healthz.storage !== "r2"
          ? "Sin R2 los archivos viven en el disco del contenedor y se pierden en cada despliegue."
          : "Credenciales de R2 completas según /healthz.",
    },
    {
      id: "whatsapp",
      nombre: "WhatsApp",
      proveedor: "Meta Cloud API · Twilio",
      descripcion: "Avisos de pedido a clientes y alertas al negocio. Ver Automatizaciones.",
      icono: MessageCircle,
      estado: { tono: "info", texto: "Por empresa" },
      detalle: "Cada negocio activa su proveedor y sus plantillas; la plataforma no expone su estado.",
    },
    {
      id: "correo",
      nombre: "Correo transaccional",
      proveedor: "Brevo",
      descripcion: "Códigos de acceso y notificaciones por correo.",
      icono: Mail,
      estado: { tono: "neutro", texto: "Sin monitor" },
      detalle: "Se configura con BREVO_API_KEY en el servidor; no hay endpoint que diga si funciona.",
    },
  ];

  return (
    <>
      <EncabezadoPagina
        antetitulo="Sistema"
        titulo="Integraciones"
        descripcion="Los servicios externos de los que depende la plataforma y cómo están."
      />
      <div className="rejilla-tarjetas">
        {integraciones.map(({ id, nombre, proveedor, descripcion, icono: Icono, estado, detalle }) => (
          <article key={id} className="tarjeta integracion">
            <div className="integracion__cabecera">
              <span className="integracion__icono" aria-hidden="true">
                <Icono size={18} />
              </span>
              <Insignia tono={estado.tono} punto>
                {estado.texto}
              </Insignia>
            </div>
            <h2 className="integracion__nombre">{nombre}</h2>
            <p className="integracion__proveedor">{proveedor}</p>
            <p className="integracion__descripcion">{descripcion}</p>
            <p className="integracion__detalle">{detalle}</p>
          </article>
        ))}
      </div>
    </>
  );
}
