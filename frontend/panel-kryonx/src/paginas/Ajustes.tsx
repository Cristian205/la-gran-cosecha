/**
 * Ajustes: la cuenta, la marca publicada y la sesión.
 *
 * Solo lo que de verdad se puede cambiar desde aquí. La configuración del
 * servidor (correo, almacenamiento) vive en sus variables de entorno y se
 * consulta en Integraciones.
 */
import { Link } from "react-router-dom";
import { LogOut, Palette } from "lucide-react";
import { usarPlataforma } from "../datos/plataforma";
import { iniciales } from "../datos/formato";
import { usarMarca } from "../marca/ProveedorMarca";
import { Boton, Dato, Tarjeta } from "../ui/basicos";
import { EncabezadoPagina } from "../componentes/piezas";
import { LogoMarca } from "../componentes/SelectorMarca";

export function Ajustes({ alSalir }: { alSalir: () => void }) {
  const { usuario } = usarPlataforma();
  const { activa } = usarMarca();

  return (
    <>
      <EncabezadoPagina antetitulo="Administración" titulo="Ajustes" descripcion="Tu cuenta y la marca con la que se ve el Control Center." />
      <div className="rejilla-dos">
        <Tarjeta titulo="Cuenta">
          <div className="perfil">
            <span className="usuario__avatar usuario__avatar--grande" aria-hidden="true">
              {iniciales(usuario?.nombre_usuario ?? "?")}
            </span>
            <div>
              <p className="perfil__nombre">{usuario?.nombre_usuario ?? "Sesión activa"}</p>
              <p className="tenue">{usuario?.email_usuario}</p>
            </div>
          </div>
          <dl className="datos">
            <Dato etiqueta="Rol">Administrador de la plataforma</Dato>
            <Dato etiqueta="Acceso">Código de un solo uso por correo</Dato>
          </dl>
        </Tarjeta>

        <Tarjeta
          titulo="Marca publicada"
          accion={
            <Link to="/marca/white-label" className="enlace-accion">
              <Palette size={13} /> Cambiar
            </Link>
          }
        >
          <div className="perfil">
            <LogoMarca marca={activa} />
          </div>
          <dl className="datos">
            <Dato etiqueta="Tipografía">{activa.tipografia}</Dato>
            <Dato etiqueta="Color principal">
              <span className="muestra-color">
                <i style={{ background: activa.colores.primario }} />
                {activa.colores.primario}
              </span>
            </Dato>
          </dl>
        </Tarjeta>

        <Tarjeta titulo="Sesión">
          <p className="tenue">Cierra la sesión en este navegador. Tendrás que pedir un código nuevo para volver.</p>
          <div className="mt-3">
            <Boton variante="peligro" icono={<LogOut size={14} />} onClick={alSalir}>
              Cerrar sesión
            </Boton>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
