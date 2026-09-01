/**
 * Ponerle a un cliente una plantilla de tienda.
 *
 * Es la misma operación que el cliente puede hacer desde su panel, pero hecha
 * por Crynex: al darlo de alta, o cuando se le rediseña la tienda.
 *
 * Por defecto NO publica. Cambiar la tienda de un cliente en marcha sin que
 * nadie la mire antes es la clase de acción de la que uno se entera por una
 * llamada, así que se deja en borrador y se dice con esas palabras.
 */
import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import type { Negocio } from "../api/tipos";
import { tienda, type Plantilla } from "../api/tienda";
import { usarPlataforma } from "../datos/plataforma";
import { Boton } from "../ui/basicos";
import { Confirmar } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

export function DialogoPlantilla({
  negocio,
  plantillas,
  onCerrar,
}: {
  negocio: Negocio;
  plantillas: Plantilla[];
  onCerrar: () => void;
}) {
  const { recargar } = usarPlataforma();
  const avisar = usarAviso();
  const disponibles = plantillas.filter((p) => p.activa);

  const [elegida, setElegida] = useState(
    disponibles.find((p) => p.es_predeterminada)?.slug ?? disponibles[0]?.slug ?? ""
  );
  const [aplicarTema, setAplicarTema] = useState(true);
  const [publicar, setPublicar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  async function aplicar() {
    setTrabajando(true);
    try {
      const r = await tienda.aplicarPlantilla(negocio.id, elegida, {
        aplicar_tema: aplicarTema,
        publicar,
      });
      await recargar();
      avisar(
        publicar
          ? `Tienda de ${negocio.nombre} actualizada y publicada.`
          : `Plantilla copiada al borrador de ${negocio.nombre} (${r.paginas.length} páginas).`
      );
      onCerrar();
    } catch (e) {
      avisar((e as Error).message, "malo");
      setTrabajando(false);
    }
  }

  return (
    <Confirmar
      titulo="Aplicar una plantilla"
      afecta={negocio.nombre}
      etiquetaAccion={publicar ? "Aplicar y publicar" : "Copiar al borrador"}
      peligrosa={publicar}
      trabajando={trabajando}
      onCerrar={onCerrar}
      onConfirmar={aplicar}
      consecuencias={
        publicar ? (
          <p>
            La tienda de este cliente cambiará <strong>de inmediato</strong>:
            sus visitantes verán las secciones de la plantilla en cuanto se
            aplique.
          </p>
        ) : (
          <p>
            Se copia a su borrador. Su tienda publicada no cambia hasta que
            alguien la revise y la publique desde el panel del negocio.
          </p>
        )
      }
    >
      <div className="formulario">
        <label className="campo">
          <span className="campo__etiqueta">Plantilla</span>
          <select value={elegida} onChange={(e) => setElegida(e.target.value)}>
            {disponibles.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nombre}
                {p.sector ? ` · ${p.sector}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="interruptor-campo">
          <input
            type="checkbox"
            checked={aplicarTema}
            onChange={(e) => setAplicarTema(e.target.checked)}
          />
          <span>
            <span className="campo__etiqueta">Aplicar también su aspecto</span>
            <span className="campo__ayuda">
              Copia los colores y las medidas de la plantilla encima de los que
              el negocio tenga.
            </span>
          </span>
        </label>

        <label className="interruptor-campo">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
          />
          <span>
            <span className="campo__etiqueta">Publicar al aplicar</span>
            <span className="campo__ayuda">
              Sin marcar, queda en borrador para que alguien la revise.
            </span>
          </span>
        </label>
      </div>
    </Confirmar>
  );
}

/** El botón que abre el diálogo, para la ficha de una empresa. */
export function BotonPlantilla({
  negocio,
  plantillas,
}: {
  negocio: Negocio;
  plantillas: Plantilla[];
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton icono={<LayoutTemplate size={14} />} onClick={() => setAbierto(true)}>
        Aplicar plantilla
      </Boton>
      {abierto && (
        <DialogoPlantilla
          negocio={negocio}
          plantillas={plantillas}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
