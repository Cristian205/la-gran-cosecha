/**
 * Identidad: la marca publicada, editable.
 *
 * Logo, favicon, colores y tipografía de la marca con la que se ve ahora el
 * Control Center, con su vista previa al lado. Guardar la aplica al momento,
 * porque es la marca publicada. Para preparar otra sin tocar esta está White
 * Label.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RotateCcw } from "lucide-react";
import logoCompleto from "../assets/logo-kryonx.png";
import monograma from "../assets/logo-kryonx-marca.png";
import { usarMarca } from "../marca/ProveedorMarca";
import type { Marca } from "../marca/tipos";
import { Boton, Tarjeta } from "../ui/basicos";
import { usarAviso } from "../ui/Notificaciones";
import { EncabezadoPagina } from "../componentes/piezas";
import { EditorMarca, VistaPreviaMarca } from "../componentes/EditorMarca";

export function Identidad() {
  const { activa, guardar, kryonModificada, restablecerKryon } = usarMarca();
  const avisar = usarAviso();
  const [borrador, setBorrador] = useState<Marca>(activa);

  useEffect(() => setBorrador(activa), [activa]);

  const cambiado = JSON.stringify(borrador) !== JSON.stringify(activa);

  const activos: { nombre: string; detalle: string; url: string | null }[] = activa.sistema
    ? [
        { nombre: "Logo completo", detalle: "PNG transparente", url: logoCompleto },
        { nombre: "Monograma", detalle: "PNG transparente", url: monograma },
        { nombre: "Favicon", detalle: "32 × 32 px", url: activa.favicon },
      ]
    : [
        { nombre: "Logo", detalle: "Monograma", url: activa.logo },
        { nombre: "Favicon", detalle: "32 × 32 px", url: activa.favicon },
      ];

  return (
    <>
      <EncabezadoPagina
        antetitulo="Marca"
        titulo="Identidad"
        descripcion={`Logo, colores y tipografía de ${activa.nombre}, la marca publicada en el Control Center.`}
        acciones={
          <>
            {activa.sistema && kryonModificada && (
              <Boton
                variante="fantasma"
                icono={<RotateCcw size={14} />}
                onClick={() => {
                  restablecerKryon();
                  avisar("Kryon X vuelve a sus valores de fábrica.");
                }}
              >
                Restablecer
              </Boton>
            )}
            <Boton disabled={!cambiado} onClick={() => setBorrador(activa)}>
              Descartar
            </Boton>
            <Boton
              variante="primario"
              disabled={!cambiado || !borrador.nombre.trim()}
              onClick={() => {
                guardar(borrador);
                avisar("Identidad guardada y aplicada.");
              }}
            >
              Guardar
            </Boton>
          </>
        }
      />

      <div className="estudio">
        <Tarjeta className="estudio__editor">
          <EditorMarca marca={borrador} onCambio={setBorrador} onError={(m) => avisar(m, "malo")} />
        </Tarjeta>
        <div className="estudio__lateral">
          <Tarjeta titulo="Vista previa" accion={<span className="tenue">En vivo</span>}>
            <VistaPreviaMarca marca={borrador} />
          </Tarjeta>
          <Tarjeta titulo="Activos de marca">
            <ul className="activos-lista">
              {activos.map((a) => (
                <li key={a.nombre}>
                  <span className="activo__vista">{a.url && <img src={a.url} alt="" />}</span>
                  <span className="activo__textos">
                    <strong>{a.nombre}</strong>
                    <span className="tenue">{a.detalle}</span>
                  </span>
                  {a.url ? (
                    <a className="icono-boton" href={a.url} download aria-label={`Descargar ${a.nombre}`}>
                      <Download size={14} />
                    </a>
                  ) : (
                    <span className="tenue">—</span>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
          <p className="nota-seccion">
            ¿Preparar otra marca sin cambiar esta? Hazlo desde <Link to="/marca/white-label">White Label</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
