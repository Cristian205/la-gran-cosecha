import Link from "next/link";
import { icono } from "./iconos";
import { claseDeVariante } from "./Seccion";

/**
 * La pantalla de acceso: media página de argumento, media de formulario.
 *
 * Es un bloque como cualquier otro —vive en una composición, se coloca desde
 * el constructor y se edita entero sin desplegar— y eso es deliberado: la
 * página de entrada es lo primero que un negocio quiere personalizar, porque
 * es donde deja de ser una tienda genérica.
 *
 * # Lo que este bloque NO hace, y no por descuido
 *
 * No autentica a nadie. Crynex todavía no tiene CUENTAS DE COMPRADOR: los
 * clientes de `orders.Cliente` son fichas que crea el negocio, sin correo ni
 * contraseña, y montar sesiones de visitante es un módulo entero —registro,
 * recuperación, verificación, «mis pedidos»— no un formulario.
 *
 * Así que el bloque pinta la pantalla y `destino` dice a dónde va el
 * formulario. Mientras esté vacío, el botón queda deshabilitado con su aviso:
 * un botón que se pulsa y no pasa nada es peor que uno apagado que explica por
 * qué, y es exactamente la clase de casilla decorativa contra la que están
 * escritos `capacidades.py` y el catálogo de tokens.
 *
 * Los accesos con Google o Facebook siguen la misma regla: son un enlace a la
 * URL que el proveedor da, así que se muestran solo si el negocio pega esa URL.
 * Uno sin destino no se dibuja.
 */
export interface VentajaAcceso {
  icono?: string;
  titulo: string;
  texto?: string;
}

export interface AccesoSocial {
  /** `google` o `facebook`: decide el color y la inicial del distintivo. */
  proveedor?: string;
  texto: string;
  href?: string;
}

interface Props {
  variante?: string;

  // --- la mitad de la izquierda: el argumento ---
  panel_titulo?: string;
  panel_titulo_resaltado?: string;
  panel_texto?: string;
  panel_imagen?: string;
  panel_imagen_alt?: string;
  panel_ventajas?: VentajaAcceso[];

  // --- la mitad de la derecha: el formulario ---
  titulo?: string;
  texto?: string;
  etiqueta_correo?: string;
  marcador_correo?: string;
  etiqueta_clave?: string;
  marcador_clave?: string;
  olvido_texto?: string;
  olvido_href?: string;
  boton_texto?: string;
  /** A dónde se manda el formulario. Vacío = todavía no hay a dónde. */
  destino?: string;
  aviso_sin_destino?: string;
  separador_texto?: string;
  sociales?: AccesoSocial[];
  pie_texto?: string;
  pie_enlace_texto?: string;
  pie_enlace_href?: string;
}

const VARIANTES = ["partido", "centrado"] as const;

export function Acceso({
  variante,
  panel_titulo = "",
  panel_titulo_resaltado = "",
  panel_texto = "",
  panel_imagen = "",
  panel_imagen_alt = "",
  panel_ventajas = [],
  titulo = "",
  texto = "",
  etiqueta_correo = "Correo electrónico",
  marcador_correo = "tu@correo.com",
  etiqueta_clave = "Contraseña",
  marcador_clave = "Ingresa tu contraseña",
  olvido_texto = "",
  olvido_href = "",
  boton_texto = "Iniciar sesión",
  destino = "",
  aviso_sin_destino = "Las cuentas de cliente todavía no están activas en esta tienda.",
  separador_texto = "",
  sociales = [],
  pie_texto = "",
  pie_enlace_texto = "",
  pie_enlace_href = "",
}: Props) {
  // Sin título del formulario no hay pantalla de acceso: lo demás es adorno
  // alrededor de él, y dibujar el adorno solo sería una página a medias.
  if (!titulo) return null;

  const clase = claseDeVariante(variante, VARIANTES, "acceso", "partido");
  const conPanel = clase.endsWith("partido") && Boolean(panel_titulo || panel_imagen);
  const activo = Boolean(destino);
  // Un enlace sin destino no se dibuja: el proveedor da la URL, y sin ella el
  // boton no llevaria a ninguna parte.
  const proveedores = sociales.filter((s) => s.href);

  return (
    <section className={`acceso ${clase} ${conPanel ? "" : "acceso--solo-forma"}`}>
      {conPanel && (
        <div className="acceso-panel">
          {panel_imagen && (
            /* `img` y no `next/image`: la foto la sube cada negocio a su bucket
               y el dominio no se conoce al compilar. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={panel_imagen} alt={panel_imagen_alt || panel_titulo} />
          )}

          <div className="acceso-panel-texto">
            {panel_titulo && (
              <h1>
                {panel_titulo}
                {panel_titulo_resaltado && (
                  <>
                    {" "}
                    <em>{panel_titulo_resaltado}</em>
                  </>
                )}
              </h1>
            )}
            {panel_texto && <p>{panel_texto}</p>}

            {panel_ventajas.length > 0 && (
              <ul className="acceso-ventajas">
                {panel_ventajas.map((v, i) => {
                  const Icono = icono(v.icono);
                  return (
                    <li key={`${v.titulo}-${i}`}>
                      <Icono size={22} strokeWidth={1.5} aria-hidden="true" />
                      <span>
                        <strong>{v.titulo}</strong>
                        {v.texto && <em>{v.texto}</em>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="acceso-forma">
        <div className="acceso-tarjeta">
          <h2>{titulo}</h2>
          {texto && <p className="acceso-subtitulo">{texto}</p>}

          <form action={destino || undefined} method="post">
            <label className="acceso-campo">
              <span>{etiqueta_correo}</span>
              <input
                type="email"
                name="correo"
                placeholder={marcador_correo}
                autoComplete="email"
                disabled={!activo}
              />
            </label>

            <label className="acceso-campo">
              <span>{etiqueta_clave}</span>
              <input
                type="password"
                name="clave"
                placeholder={marcador_clave}
                autoComplete="current-password"
                disabled={!activo}
              />
            </label>

            {olvido_texto && (
              <div className="acceso-olvido">
                <Link href={olvido_href || "#"}>{olvido_texto}</Link>
              </div>
            )}

            <button type="submit" className="btn primario acceso-boton" disabled={!activo}>
              {boton_texto}
            </button>

            {!activo && <p className="acceso-aviso">{aviso_sin_destino}</p>}
          </form>

          {proveedores.length > 0 && (
            <>
              {separador_texto && (
                <div className="acceso-separador">
                  <span>{separador_texto}</span>
                </div>
              )}
              <div className="acceso-sociales">
                {proveedores.map((s, i) => (
                  <a
                    key={`${s.texto}-${i}`}
                    className={`acceso-social acceso-social--${s.proveedor || "otro"}`}
                    href={s.href}
                  >
                    <span className="acceso-social-marca" aria-hidden="true">
                      {(s.proveedor || "?").slice(0, 1).toUpperCase()}
                    </span>
                    {s.texto}
                  </a>
                ))}
              </div>
            </>
          )}

          {pie_texto && (
            <p className="acceso-pie">
              {pie_texto}{" "}
              {pie_enlace_texto && (
                <Link href={pie_enlace_href || "/"}>{pie_enlace_texto}</Link>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
