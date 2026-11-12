/**
 * Dar de alta un cliente.
 *
 * Es la única pantalla de Kryon X que crea una empresa, y por eso pide de una
 * vez las cuatro decisiones que no tienen un valor por defecto razonable:
 * quién es, por dónde se llega, qué plan tiene y con qué tienda arranca. Todo
 * lo demás —su configuración, su suscripción, sus páginas— lo montan las
 * señales del backend.
 *
 * Va en tres pasos —identidad, plan y tienda, revisión— para que cada decisión
 * se tome por separado y se vea el resumen antes de crear nada.
 */
import { useState } from "react";
import { tienda, type Plantilla } from "../api/tienda";
import { usarPlataforma } from "../datos/plataforma";
import { Aviso, Campo } from "../ui/basicos";
import { ModalAsistente, Resumen, type Paso } from "../ui/Asistente";
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

  const planElegido = disponibles.find((p) => p.slug === plan) ?? disponibles.find((p) => p.es_predeterminado);
  const plantillaElegida = plantillas.find((p) => p.slug === plantilla);
  const slugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

  const pasos: Paso[] = [
    {
      id: "identidad",
      titulo: "Identidad",
      valido: nombre.trim().length > 1 && slugOk,
      contenido: (
        <>
          {error && <Aviso>{error}</Aviso>}
          <Campo etiqueta="Nombre de la empresa">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Perfumería Luna" autoFocus />
          </Campo>
          <Campo
            etiqueta="Identificador"
            ayuda="Va en su subdominio y en las rutas de sus archivos. No se puede cambiar después sin dejar archivos huérfanos."
          >
            <input value={slug} onChange={(e) => setSlugManual(aSlug(e.target.value))} spellCheck={false} />
          </Campo>
          {slug && !slugOk && <p className="aviso aviso--malo">El identificador solo admite letras, números y guiones.</p>}
          <Campo
            etiqueta="Dominio"
            ayuda="Opcional. Sin dominio la empresa existe, pero su tienda no responde en ninguna dirección."
          >
            <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="perfumerialuna.com" spellCheck={false} />
          </Campo>
        </>
      ),
    },
    {
      id: "plan",
      titulo: "Plan y tienda",
      contenido: (
        <>
          <Campo etiqueta="Plan" ayuda="Lo que podrá hacer y hasta dónde. Se puede cambiar después.">
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">
                El predeterminado
                {disponibles.find((p) => p.es_predeterminado) ? ` (${disponibles.find((p) => p.es_predeterminado)!.nombre})` : ""}
              </option>
              {disponibles.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Plantilla de tienda" ayuda="Se copian sus secciones y su aspecto, y la tienda queda publicada.">
            <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)}>
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
          </Campo>
        </>
      ),
    },
    {
      id: "revision",
      titulo: "Revisión",
      contenido: (
        <>
          {error && <Aviso>{error}</Aviso>}
          <Resumen
            filas={[
              { etiqueta: "Empresa", valor: nombre.trim() },
              { etiqueta: "Identificador", valor: <code>{slug}</code> },
              { etiqueta: "Dominio", valor: dominio.trim() },
              { etiqueta: "Plan", valor: planElegido?.nombre },
              { etiqueta: "Plantilla", valor: plantillaElegida?.nombre ?? "Sin plantilla" },
              { etiqueta: "Estado inicial", valor: "En prueba" },
            ]}
          />
          <p className="tenue text-xs">Al darla de alta se crean su suscripción, su configuración y sus páginas.</p>
        </>
      ),
    },
  ];

  return (
    <ModalAsistente
      titulo="Nueva empresa"
      descripcion="Nace con su tienda, su plan y su configuración."
      pasos={pasos}
      etiquetaFinal="Dar de alta"
      trabajando={creando}
      onCerrar={onCerrar}
      onFinalizar={crear}
    />
  );
}
