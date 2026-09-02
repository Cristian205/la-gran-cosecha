import { useCallback, useEffect, useState } from "react";
import { Blocks, Lock, SlidersHorizontal } from "lucide-react";
import {
  cambiarModulo,
  guardarPerfil,
  obtenerModulos,
  obtenerPerfil,
  type Modulo,
  type PerfilNegocio,
} from "../../api/negocio";
import { useAuth } from "../../auth/AuthContext";
import { extraerMensajeError } from "../../utils";
import { alertaError, alertaExito } from "../../utils/alertas";
import { AltaGuiada } from "./AltaGuiada";

/**
 * Cómo trabaja este negocio, y con qué módulos.
 *
 * La pantalla tiene dos estados porque el negocio tiene dos: sin configurar
 * —y entonces lo que hace falta es el asistente— o configurado, y entonces lo
 * que hace falta es poder ajustar lo que el asistente dejó puesto.
 *
 * Lo que NO hay aquí es un selector de «tipo de negocio». Es deliberado: el
 * sector es una etiqueta y cambiarla no cambiaría nada. Lo que gobierna el
 * comportamiento son las capacidades, y son las que se editan.
 */
export function BusinessProfilePage() {
  const { usuario } = useAuth();
  // El perfil decide cómo se comporta el negocio entero, así que ajustarlo es
  // cosa del dueño. El resto del equipo lo ve, pero no lo toca.
  const puedeEditar = Boolean(usuario?.es_administrador);

  const [perfil, setPerfil] = useState<PerfilNegocio | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [p, m] = await Promise.all([obtenerPerfil(), obtenerModulos()]);
      setPerfil(p);
      setModulos(m);
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo cargar la configuración."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternarCapacidad(codigo: string, valor: boolean) {
    if (!perfil) return;
    const antes = perfil.capacidades;
    const ahora = { ...antes, [codigo]: valor };
    // Optimista: el interruptor responde al instante y se revierte si el
    // servidor dice que no. Esperar la respuesta hace que parezca roto.
    setPerfil({ ...perfil, capacidades: ahora });
    setGuardando(true);
    try {
      const actualizado = await guardarPerfil({ capacidades: ahora });
      setPerfil({ ...perfil, ...actualizado });
    } catch (err) {
      setPerfil({ ...perfil, capacidades: antes });
      alertaError(extraerMensajeError(err, "No se pudo guardar el cambio."));
    } finally {
      setGuardando(false);
    }
  }

  async function alternarModulo(modulo: Modulo, valor: boolean) {
    setGuardando(true);
    try {
      setModulos(await cambiarModulo(modulo.slug, valor));
    } catch (err) {
      alertaError(
        extraerMensajeError(err, "No se pudo cambiar el módulo.")
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <>
        <div className="topbar">
          <h1>Tu negocio</h1>
        </div>
        <div className="contenido">
          <div className="panel">Cargando…</div>
        </div>
      </>
    );
  }

  if (perfil && !perfil.esta_configurado) {
    return (
      <>
        <div className="topbar">
          <h1>Tu negocio</h1>
        </div>
        <div className="contenido">
          {puedeEditar ? (
            <AltaGuiada
              onConfigurado={() => {
                void cargar();
                alertaExito("Listo. Tu negocio ya está configurado.");
              }}
            />
          ) : (
            <div className="panel vacio">
              Este negocio todavía no está configurado. Pídeselo al dueño de la cuenta.
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Tu negocio</h1>
      </div>

      <div className="contenido">
        {!puedeEditar && (
          <div className="panel" style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <Lock size={15} />
            Solo el dueño o un administrador puede cambiar esta configuración.
          </div>
        )}

        <div className="panel">
          <div className="modal-seccion">
            <SlidersHorizontal size={16} />
            <span>Cómo trabajas</span>
          </div>
          <p className="form-nota">
            {perfil?.preset_nombre
              ? `Partiste de la configuración «${perfil.preset_nombre}». Ajusta lo que no encaje.`
              : "Ajusta lo que describe a tu negocio."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
            {perfil?.catalogo_capacidades.map((cap) => (
              <div key={cap.codigo} className="campo-switch">
                <label className="switch">
                  <input
                    type="checkbox"
                    disabled={!puedeEditar || guardando}
                    checked={perfil.capacidades[cap.codigo] ?? cap.defecto}
                    onChange={(e) => alternarCapacidad(cap.codigo, e.target.checked)}
                  />
                  <span className="switch-riel" />
                </label>
                <div>
                  <div className="campo-switch-titulo">{cap.nombre}</div>
                  <div className="campo-switch-desc">{cap.descripcion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="modal-seccion">
            <Blocks size={16} />
            <span>Módulos</span>
          </div>
          <p className="form-nota">
            Se muestran todos, también los que tu plan aún no incluye: no puedes
            pedir lo que no sabes que existe.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
            {modulos.map((m) => (
              <div key={m.slug} className="campo-switch">
                <label className="switch">
                  <input
                    type="checkbox"
                    disabled={!puedeEditar || !m.disponible || guardando}
                    checked={m.activo && m.disponible}
                    onChange={(e) => alternarModulo(m, e.target.checked)}
                  />
                  <span className="switch-riel" />
                </label>
                <div>
                  <div className="campo-switch-titulo">
                    {m.nombre}
                    {!m.disponible && (
                      <span
                        className="badge"
                        style={{
                          marginLeft: ".5rem",
                          background: "var(--ambar-claro)",
                          color: "var(--ambar-texto)",
                        }}
                      >
                        No incluido en tu plan
                      </span>
                    )}
                  </div>
                  <div className="campo-switch-desc">{m.descripcion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
