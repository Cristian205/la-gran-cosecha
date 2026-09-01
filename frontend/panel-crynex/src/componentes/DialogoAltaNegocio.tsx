/**
 * Dar de alta un cliente.
 *
 * Es la única pantalla de Crynex que crea una empresa, y por eso pide de una
 * vez las cuatro decisiones que no tienen un valor por defecto razonable:
 * quién es, por dónde se llega, qué plan tiene y con qué tienda arranca. Todo
 * lo demás —su configuración, su suscripción, sus páginas— lo montan las
 * señales del backend.
 *
 * Pedirlo todo junto y no en pasos es deliberado: son cuatro campos, y un
 * asistente de tres pantallas para cuatro campos es ceremonia.
 */
import { useState } from "react";
import { Building2 } from "lucide-react";
import { tienda, type Plantilla } from "../api/tienda";
import { usarPlataforma } from "../datos/plataforma";
import { Boton } from "../ui/basicos";
import { Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";

/** El identificador sale del nombre: hacérselo escribir a alguien da erratas. */
function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function DialogoAltaNegocio({
  plantillas,
  onCerrar,
  onCreado,
}: {
  plantillas: Plantilla[];
  onCerrar: () => void;
  onCreado: () => void;
}) {
  const { planes, recargar } = usarPlataforma();
  const avisar = usarAviso();

  const [nombre, setNombre] = useState("");
  const [slugManual, setSlugManual] = useState<string | null>(null);
  const [dominio, setDominio] = useState("");
  const [plan, setPlan] = useState("");
  const [plantilla, setPlantilla] = useState(
    plantillas.find((p) => p.es_predeterminada)?.slug ?? plantillas[0]?.slug ?? ""
  );
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El slug sigue al nombre hasta que alguien lo toca a mano; desde entonces,
  // manda el suyo. Sobrescribirlo después sería descartar una decisión.
  const slug = slugManual ?? aSlug(nombre);

  const disponibles = planes.filter((p) => p.activo);

  async function crear() {
    setCreando(true);
    setError(null);
    try {
      const nuevo = await tienda.altaNegocio({
        nombre: nombre.trim(),
        slug,
        dominio: dominio.trim() || undefined,
        plan: plan || undefined,
        plantilla: plantilla || undefined,
        aplicar_tema: true,
        estado: "PRUEBA",
      });
      // Se recarga entero y no se añade a mano: el alta crea suscripción y
      // páginas, y la lista local no sabría de ninguna de las dos.
      await recargar();
      avisar(`${nuevo.nombre} dada de alta.`);
      onCreado();
    } catch (e) {
      setError((e as Error).message);
      setCreando(false);
    }
  }

  return (
    <Modal
      titulo="Nueva empresa"
      descripcion="Nace con su tienda, su plan y su configuración."
      ancho={520}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton onClick={onCerrar} disabled={creando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            icono={<Building2 size={14} />}
            onClick={crear}
            disabled={!nombre.trim() || !slug}
            cargando={creando}
          >
            Dar de alta
          </Boton>
        </>
      }
    >
      {error && (
        <p className="aviso aviso--malo" role="alert">
          {error}
        </p>
      )}

      <div className="formulario">
        <label className="campo">
          <span className="campo__etiqueta">Nombre de la empresa</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Perfumería Luna"
            autoFocus
          />
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Identificador</span>
          <input
            value={slug}
            onChange={(e) => setSlugManual(aSlug(e.target.value))}
            spellCheck={false}
          />
          <span className="campo__ayuda">
            Va en su subdominio y en las rutas de sus archivos. No se puede
            cambiar después sin dejar archivos huérfanos.
          </span>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Dominio</span>
          <input
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            placeholder="perfumerialuna.com"
            spellCheck={false}
          />
          <span className="campo__ayuda">
            Opcional. Sin dominio la empresa existe, pero su tienda no responde
            en ninguna dirección.
          </span>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">
              El predeterminado
              {disponibles.find((p) => p.es_predeterminado)
                ? ` (${disponibles.find((p) => p.es_predeterminado)!.nombre})`
                : ""}
            </option>
            {disponibles.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Plantilla de tienda</span>
          <select
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
          >
            <option value="">Sin plantilla</option>
            {plantillas
              .filter((p) => p.activa)
              .map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.nombre}
                  {p.sector ? ` · ${p.sector}` : ""}
                </option>
              ))}
          </select>
          <span className="campo__ayuda">
            Se copian sus secciones y su aspecto, y la tienda queda publicada.
          </span>
        </label>
      </div>
    </Modal>
  );
}
