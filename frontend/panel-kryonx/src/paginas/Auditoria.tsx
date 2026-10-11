/**
 * Auditoría: quién cambió qué y cuándo.
 *
 * Todavía no existe la tabla que lo registre, así que la página no simula
 * filas: explica qué guardará y lleva a lo más parecido que hay hoy.
 */
import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { EstadoVacio } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";

export function Auditoria() {
  return (
    <>
      <EncabezadoPagina
        antetitulo="Administración"
        titulo="Auditoría"
        descripcion="El registro de cada cambio hecho desde el Control Center."
      />
      <section className="tarjeta">
        <EstadoVacio
          icono={ScrollText}
          titulo="El registro de auditoría todavía no existe"
          accion={
            <Link to="/actividad" className="btn btn--secundario">
              Ver la actividad disponible
            </Link>
          }
        >
          Guardará quién cambió un plan, suspendió una empresa o editó un permiso, con la fecha y el
          valor anterior. Hasta que el backend lo registre, Actividad reconstruye altas y
          suscripciones a partir de sus fechas.
        </EstadoVacio>
      </section>
    </>
  );
}
