import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  actualizarPermisosUsuario,
  obtenerPermisosDisponibles,
  obtenerPermisosUsuario,
} from "../../api/resources";
import type { ModuloPermisos, Usuario } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  usuario: Usuario;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function UserPermissionsModal({ usuario, onCerrar, onGuardado }: Props) {
  const [catalogo, setCatalogo] = useState<ModuloPermisos[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([obtenerPermisosDisponibles(), obtenerPermisosUsuario(usuario.id)])
      .then(([cat, permisos]) => {
        setCatalogo(cat);
        setSeleccionados(new Set(permisos));
      })
      .catch(() => setError("No se pudieron cargar los permisos."))
      .finally(() => setCargando(false));
  }, [usuario.id]);

  function alternar(codename: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(codename)) next.delete(codename);
      else next.add(codename);
      return next;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await actualizarPermisosUsuario(usuario.id, [...seleccionados]);
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudieron guardar los permisos."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo={`Permisos de ${usuario.nombre_usuario}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando || cargando}>
            {guardando ? "Guardando…" : "Guardar permisos"}
          </button>
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}

      <div className="ok-box" style={{ display: "flex", gap: ".6rem", alignItems: "flex-start" }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>
          Marca solo lo que <strong>{usuario.nombre_usuario}</strong> debe poder hacer.
          Todo lo demás quedará bloqueado, incluso si es un usuario ADMIN o ANALISTA.
        </span>
      </div>

      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : (
        <div className="permisos-lista">
          {catalogo.map((m) => (
            <div className="permisos-modulo" key={m.modulo}>
              <h3>{m.modulo}</h3>
              <div className="permisos-grid">
                {m.permisos.map((p) => (
                  <label className="permiso-chip" key={p.codename}>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.codename)}
                      onChange={() => alternar(p.codename)}
                    />
                    {p.etiqueta}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
