import { useEffect, useState } from "react";
import { Check, Sparkles, Wand2 } from "lucide-react";
import {
  adoptarPreset,
  obtenerAlta,
  sugerirPresets,
  type PreguntaAlta,
  type PresetSugerido,
} from "../../api/negocio";
import { extraerMensajeError } from "../../utils";

interface Props {
  onConfigurado: () => void;
}

/**
 * El alta guiada: ocho preguntas y una elección.
 *
 * Dos decisiones de diseño que no son estéticas:
 *
 * 1. Las preguntas son sobre cómo TRABAJA el negocio —«¿vendes por peso?»,
 *    «¿cobras en mostrador?»— y no sobre qué tipo de negocio es. Un dueño sabe
 *    contestar lo primero sin dudar; lo segundo lo obliga a encajarse en una
 *    categoría que quizá no le cuadre.
 *
 * 2. El asistente SUGIERE y una persona elige. Nunca configura solo. Un
 *    asistente que decide es imposible de corregir cuando se equivoca, y por eso
 *    cada candidato viene con sus motivos a la vista: cuando falla, se ve en qué
 *    señal falló.
 */
export function AltaGuiada({ onConfigurado }: Props) {
  const [preguntas, setPreguntas] = useState<PreguntaAlta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({});
  const [candidatos, setCandidatos] = useState<PresetSugerido[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerAlta()
      .then((datos) => setPreguntas(datos.preguntas))
      .catch((err) => setError(extraerMensajeError(err, "No se pudo cargar el asistente.")))
      .finally(() => setCargando(false));
  }, []);

  async function calcular() {
    setError(null);
    setTrabajando(true);
    try {
      const sugeridos = await sugerirPresets(respuestas);
      setCandidatos(sugeridos);
      setElegido(sugeridos[0]?.preset.slug ?? null);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudieron calcular las sugerencias."));
    } finally {
      setTrabajando(false);
    }
  }

  async function confirmar() {
    if (!elegido) return;
    setError(null);
    setTrabajando(true);
    try {
      await adoptarPreset(elegido, respuestas);
      onConfigurado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo configurar el negocio."));
    } finally {
      setTrabajando(false);
    }
  }

  if (cargando) return <div className="panel">Cargando el asistente…</div>;

  return (
    <div className="panel">
      <div className="modal-seccion">
        <Wand2 size={16} />
        <span>Configura tu negocio</span>
      </div>
      <p className="form-nota">
        Ocho preguntas sobre cómo trabajas. Con eso te proponemos una
        configuración de partida — y podrás cambiar lo que quieras después.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: ".25rem", marginTop: "1rem" }}>
        {preguntas.map((p) => (
          <label key={p.codigo} className="campo-switch" style={{ cursor: "pointer" }}>
            <span className="switch">
              <input
                type="checkbox"
                checked={respuestas[p.codigo] ?? false}
                onChange={(e) =>
                  setRespuestas((prev) => ({ ...prev, [p.codigo]: e.target.checked }))
                }
              />
              <span className="switch-riel" />
            </span>
            <div>
              <div className="campo-switch-titulo">{p.texto}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ marginTop: "1.25rem", display: "flex", gap: ".5rem" }}>
        <button className="btn primario" onClick={calcular} disabled={trabajando}>
          <Sparkles size={16} /> {candidatos ? "Recalcular" : "Ver qué me conviene"}
        </button>
      </div>

      {candidatos && (
        <>
          <div className="modal-seccion" style={{ marginTop: "1.75rem" }}>
            <span>Lo que te proponemos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            {candidatos.map((c) => {
              const activo = elegido === c.preset.slug;
              return (
                <button
                  key={c.preset.slug}
                  type="button"
                  onClick={() => setElegido(c.preset.slug)}
                  style={{
                    textAlign: "left",
                    padding: "1rem",
                    borderRadius: ".6rem",
                    cursor: "pointer",
                    background: "var(--blanco, #fff)",
                    border: activo
                      ? "2px solid var(--verde-texto)"
                      : "1px solid var(--gris-claro)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".5rem",
                      fontWeight: 600,
                    }}
                  >
                    {activo && <Check size={16} />}
                    {c.preset.nombre}
                  </div>
                  <div style={{ fontSize: ".85rem", color: "var(--gris-texto, #666)" }}>
                    {c.preset.descripcion}
                  </div>
                  {/* El porqué, a la vista. Cuando el asistente se equivoca,
                      esto es lo que dice en qué se equivocó. */}
                  {c.motivos.length > 0 && (
                    <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.1rem", fontSize: ".82rem" }}>
                      {c.motivos.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                  {c.modulos_no_cubiertos.length > 0 && (
                    <div
                      style={{
                        marginTop: ".5rem",
                        fontSize: ".8rem",
                        color: "var(--ambar-texto)",
                      }}
                    >
                      Tu plan todavía no incluye: {c.modulos_no_cubiertos.join(", ")}.
                      Se configurará sin eso.
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              className="btn primario"
              onClick={confirmar}
              disabled={trabajando || !elegido}
            >
              {trabajando ? "Configurando…" : "Usar esta configuración"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
